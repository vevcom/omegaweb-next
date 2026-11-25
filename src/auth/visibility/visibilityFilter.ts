import type { MembershipFiltered } from '@/services/groups/types'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { DoubleLevel } from '@/services/visibility/types'

/** The rows of one `Visibility` relation the memberships satisfy, the filter half of `checkVisibility`. */
export function visibilityFilter(memberships: MembershipFiltered[]) {
    return {
        requirements: {
            every: {
                conditions: {
                    some: {
                        OR: memberships.map(membership => ({
                            groupId: membership.groupId,
                            OR: [{ order: null }, { order: membership.order }],
                            ...(membership.active ? {} : { onlyActive: false }),
                            ...(membership.admin ? {} : { onlyAdmins: false }),
                        })),
                    }
                }
            }
        }
    } as const satisfies Prisma.VisibilityWhereInput
}

export type VisibilityFilter = ReturnType<typeof visibilityFilter>

/**
 * The filter half of `checkDoubleLevelVisibility`: the rows whose `level` the memberships pass.
 * Every model with a double level visibility names its relations `visibilityRegular` and
 * `visibilityAdmin`, which is what lets one filter serve them all. As passing the admin level
 * passes the regular level, the regular filter is the OR of the two relations.
 */
export function doubleLevelVisibilityFilter(memberships: MembershipFiltered[], level: DoubleLevel) {
    const filter = visibilityFilter(memberships)
    return level === 'ADMIN'
        ? { visibilityAdmin: filter }
        : { OR: [{ visibilityRegular: filter }, { visibilityAdmin: filter }] }
}

export type DoubleLevelVisibilityFilter = ReturnType<typeof doubleLevelVisibilityFilter>
