import { FRIDGE_NAME } from '@/seeder/src/standardContent/seedShop'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/**
 * Upserts the dev products into the fridge shop, keyed on the unique product name. An existing
 * product is left untouched - including its price and whether it is stocked in the fridge.
 */
export const seedDevShop = defineSeedOperation(async (prisma: PrismaClient) => {
    const fridge = await prisma.shop.findUniqueOrThrow({
        where: {
            name: FRIDGE_NAME,
        },
    })

    const products: {
        name: string,
        description?: string,
        barcode?: string,
        price: number,
    }[] = [
        {
            name: 'Dahls',
            price: 3000,
        },
        {
            name: 'Hansa',
            price: 3400,
        },
        {
            name: 'Smirnoff ICE',
            price: 4200,
            barcode: '5410316983693'
        },
        {
            name: 'Isbjørn Lite',
            price: 3400,
        },
        {
            name: 'Kakao',
            price: 500,
            barcode: '7622210610416'
        },
        {
            name: 'Crush Cloudy',
            price: 4700,
        },
    ]

    await Promise.all(products.map(product => prisma.product.upsert({
        where: { name: product.name.toUpperCase() },
        update: {},
        create: {
            name: product.name.toUpperCase(),
            description: product.description,
            barcode: product.barcode,
            suggestedPrice: product.price,
            ShopProduct: {
                create: {
                    price: product.price,
                    shop: {
                        connect: {
                            id: fridge.id,
                        },
                    },
                },
            },
        },
    })))
})
