import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

export const seedDevImages = defineSeedOperation(async (prisma: PrismaClient) => {
    const { group: memberGroup } = await prisma.omegaMembershipGroup.findUniqueOrThrow({
        where: { omegaMembershipLevel: 'SYSKEN' },
        select: { group: { select: { id: true, order: true } } },
    })

    await Promise.all(
        Array.from({ length: 10 }).map((_, index) => upsertTestImageCollection(prisma, index, memberGroup))
    )
})

async function upsertTestImageCollection(
    prisma: PrismaClient,
    index: number,
    memberGroup: { id: number, order: number },
) {
    return prisma.imageCollection.upsert({
        where: {
            name: `dev_images_${index}`
        },
        update: {},
        create: {
            name: `dev_images_${index}`,
            description: 'just a test',
            visibilityAdmin: {
                create: { requirements: { create: [{}] } }
            },
            visibilityRegular: {
                create: {
                    requirements: {
                        create: [{
                            // ACTIVE conditions are stored pinned to the current order, as visibilityOperations does.
                            conditions: {
                                create: [{ type: 'ACTIVE', groupId: memberGroup.id, order: memberGroup.order }]
                            }
                        }]
                    }
                }
            }
        }
    })
}
