import type { Prisma } from '@/prisma-generated-pn-types'

type Visibility = {
    requirements: {
        conditions: { type: 'ACTIVE' | 'ORDER', groupId: number, order: number }[],
    }[],
}

/**
 * The users passing a visibility, as a filter: the Prisma mirror of `checkVisibility`. Every
 * requirement needs some condition met by a membership.
 */
export function passesVisibilityWhere(visibility: Visibility): Prisma.UserWhereInput {
    return {
        AND: visibility.requirements.map(requirement => ({
            memberships: {
                some: {
                    OR: requirement.conditions.map(condition => (condition.type === 'ACTIVE' ? {
                        groupId: condition.groupId,
                        active: true,
                    } : {
                        groupId: condition.groupId,
                        order: condition.order,
                    })),
                },
            },
        })),
    }
}
