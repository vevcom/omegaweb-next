import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const BULLSHIT_COUNT = 100

export const seedDevBullshit = defineSeedOperation(async (prisma: PrismaClient) => {
    const user = await prisma.user.findFirst({})
    if (!user) {
        return
    }

    await Promise.all(Array.from({ length: BULLSHIT_COUNT }, async (_, index) => {
        const quote = `Bullshit ${index + 1}`
        const existing = await prisma.bullshit.findFirst({
            where: { quote },
            select: { id: true },
        })
        if (existing) return

        await prisma.bullshit.create({
            data: {
                quote,
                bullshitPoster: {
                    connect: {
                        id: user.id
                    }
                },
            }
        })
    }))
})
