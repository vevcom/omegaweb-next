import type { MembershipFiltered } from '@/services/groups/types'
import type { DoubleLevel, DoubleLevelVisibilityMatrix, VisibilityMatrix } from '@/services/visibility/types'


export function checkVisibility(memberships: MembershipFiltered[], visibility: VisibilityMatrix): boolean {
    return visibility.requirements.every(
        requirement => requirement.conditions.some(
            condition => {
                if (condition.type === 'ACTIVE') {
                    return memberships.some(
                        membership => membership.groupId === condition.groupId && membership.active
                    )
                }
                if (condition.type === 'ORDER') {
                    return memberships.some(
                        membership => membership.groupId === condition.groupId && membership.order === condition.order
                    )
                }
                return false
            }
        )
    )
}

/** Whether the memberships pass `level` of a double level visibility. The admin level passes the
 * regular level too, so an administrator always sees what they administrate. */
export function checkDoubleLevelVisibility(
    memberships: MembershipFiltered[],
    visibility: DoubleLevelVisibilityMatrix,
    level: DoubleLevel,
): boolean {
    if (checkVisibility(memberships, visibility.adminLevel)) return true
    return level === 'REGULAR' && checkVisibility(memberships, visibility.regularLevel)
}
