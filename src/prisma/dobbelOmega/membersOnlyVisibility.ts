import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'

/**
 * Create input for a visibility that only active members of Omega satisfy. This is the standard
 * regular level for migrated events and image collections.
 */
export async function membersOnlyVisibility(pnPrisma: PrismaClientPn) {
    const { group } = await pnPrisma.omegaMembershipGroup.findUniqueOrThrow({
        where: { omegaMembershipLevel: 'SYSKEN' },
        select: { group: { select: { id: true, order: true } } },
    })
    return {
        requirements: {
            create: [{
                conditions: {
                    // ACTIVE conditions are stored pinned to the current order, as visibilityOperations does.
                    create: [{ type: 'ACTIVE' as const, groupId: group.id, order: group.order }]
                }
            }]
        }
    }
}
