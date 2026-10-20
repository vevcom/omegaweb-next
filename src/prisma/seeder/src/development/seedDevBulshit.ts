import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const BULSHIT_COUNT = 100

export const seedDevBulshit = defineSeedOperation(async (prisma: PrismaClient) => {
    const user = await prisma.user.findFirst({})
    if (!user) {
        return
    }

    await Promise.all(Array.from({ length: BULSHIT_COUNT }, async (_, index) => {
        const quote = `Bulshit ${index + 1}`
        const existing = await prisma.bulshit.findFirst({
            where: { quote },
            select: { id: true },
        })
        if (existing) return

        await prisma.bulshit.create({
            data: {
                quote,
                bulshitPoster: {
                    connect: {
                        id: user.id
                    }
                },
            }
        })
    }))
})
