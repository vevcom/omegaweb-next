import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

export const seedDevImages = defineSeedOperation(async (prisma: PrismaClient) => {
    const { group: memberGroup } = await prisma.omegaMembershipGroup.findUniqueOrThrow({
        where: { omegaMembershipLevel: 'SYSKEN' },
        select: { group: { select: { id: true } } },
    })

    await Promise.all(
        Array.from({ length: 10 }).map((_, index) => upsertTestImageCollection(prisma, index, memberGroup))
    )
})

async function upsertTestImageCollection(
    prisma: PrismaClient,
    index: number,
    memberGroup: { id: number },
) {
    return prisma.imageCollection.upsert({
        where: {
            name: `dev_images_${index}`
        },
        update: {},
        create: {
            name: `dev_images_${index}`,
            description: 'Bare en test',
            visibilityAdmin: {
                create: { requirements: { create: [{}] } }
            },
            visibilityRegular: {
                create: {
                    requirements: {
                        create: [{
                            conditions: {
                                create: [{ groupId: memberGroup.id, order: null, onlyActive: true, onlyAdmins: false }]
                            }
                        }]
                    }
                }
            }
        }
    })
}
