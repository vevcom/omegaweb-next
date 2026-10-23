import type { MembershipFiltered } from '@/services/groups/types'
import type { Prisma } from '@/prisma-generated-pn-types'

export function visibilityFilter(memberships: MembershipFiltered[]) {
    return {
        requirements: {
            every: {
                conditions: {
                    some: {
                        OR: [
                            {
                                type: 'ACTIVE',
                                groupId: {
                                    in: memberships
                                        .filter(membership => membership.active)
                                        .map(membership => membership.groupId)
                                }
                            },
                            {
                                type: 'ORDER',
                                OR: memberships
                                    .map(membership => ({
                                        groupId: membership.groupId,
                                        order: membership.order
                                    }))
                            },
                        ]
                    }
                }
            }
        }
    } as const satisfies Prisma.VisibilityWhereInput
}

export type VisibilityFilter = ReturnType<typeof visibilityFilter>

/**
 * The regular level of a double-level visibility as a `where` on the model owning the two levels.
 * Whoever administrates also sees, as in `Require.levelOfDoubleVisibility`, so a row passes on
 * either level. Every model with a double level names its relations visibilityRegular and
 * visibilityAdmin, which is what makes one filter fit them all.
 */
export function regularLevelFilter(filter: VisibilityFilter) {
    return {
        OR: [
            { visibilityRegular: filter },
            { visibilityAdmin: filter },
        ]
    }
}
