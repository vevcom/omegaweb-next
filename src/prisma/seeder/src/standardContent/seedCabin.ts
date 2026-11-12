import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { CabinProduct, CabinProductPrice } from '@/prisma-generated-pn-types'

type SeedCabinProductConfig = Omit<CabinProduct, 'id' | 'createdAt' | 'updatedAt'> & {
    CabinProductPrice: (Omit<CabinProductPrice, 'id' | 'cabinProductId' | 'pricePeriodId'>)[]
}

const NEXT_PERIOD_PRICE_FACTOR = 1.5

/**
 * Seeds the cabin products, and the initial price and release periods.
 *
 * The periods are dated relative to the run, so there is no stable key to match existing rows
 * against one by one, and prices edited through the admin pages should not be undone by a re-seed.
 * So the whole seed is skipped once any cabin product exists.
 */
export const seedCabin = defineSeedOperation(async (prisma: PrismaClient) => {
    const products: SeedCabinProductConfig[] = [
        {
            name: 'Hele hytta',
            amount: 1,
            type: 'CABIN',
            CabinProductPrice: [
                {
                    description: 'Søn-Tors',
                    cronInterval: '* * 0-4',
                    price: 100000,
                    memberShare: 0,
                },
                {
                    description: 'Helg (>50% Omega)',
                    cronInterval: '* * 5-6',
                    price: 470000 * 0.5,
                    memberShare: 50,
                },
                {
                    description: 'Helg (med Omega)',
                    cronInterval: '* * 5-6',
                    price: 470000 * 0.75,
                    memberShare: 1,
                },
                {
                    description: 'Helg',
                    cronInterval: '* * 5-6',
                    price: 470000,
                    memberShare: 0,
                },
            ]
        },
        {
            name: 'Seng (120 cm)',
            amount: 3,
            type: 'BED',
            CabinProductPrice: [{
                description: '',
                cronInterval: '* * *',
                price: 25000,
                memberShare: 0,
            }]
        },
        {
            name: 'Køyeseng (90 cm)',
            amount: 14,
            type: 'BED',
            CabinProductPrice: [{
                description: '',
                cronInterval: '* * *',
                price: 15000,
                memberShare: 0,
            }]
        }
    ]

    const alreadySeeded = await prisma.cabinProduct.findFirst({ select: { id: true } })
    if (alreadySeeded) return

    const now = new Date()

    const [pricePeriod, secondPricePeriod] = await Promise.all([
        prisma.pricePeriod.create({
            data: {
                validFrom: now
            }
        }),
        prisma.pricePeriod.create({
            data: {
                validFrom: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()))
            }
        }),
    ])

    await Promise.all(products.map(product =>
        prisma.cabinProduct.create({
            data: {
                name: product.name,
                amount: product.amount,
                type: product.type,
                CabinProductPrice: {
                    create: product.CabinProductPrice.flatMap(price => [
                        {
                            ...price,
                            pricePeriodId: pricePeriod.id
                        },
                        {
                            ...price,
                            pricePeriodId: secondPricePeriod.id,
                            price: Math.round(price.price * NEXT_PERIOD_PRICE_FACTOR)
                        },
                    ])
                }
            }
        })
    ))

    await prisma.releasePeriod.createMany({
        data: [
            {
                releaseTime: now,
                releaseUntil: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, now.getUTCDate()))
            },
            {
                releaseTime: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())),
                releaseUntil: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 4, now.getUTCDate()))
            },
        ],
    })
})
