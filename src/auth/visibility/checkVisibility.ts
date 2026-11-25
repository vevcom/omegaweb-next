import type { MembershipFiltered } from '@/services/groups/types'
import type {
    DoubleLevel,
    DoubleLevelVisibilityMatrix,
    VisibilityCondition,
    VisibilityMatrix,
} from '@/services/visibility/types'


export function checkVisibility(memberships: MembershipFiltered[], visibility: VisibilityMatrix): boolean {
    return visibility.requirements.every(
        requirement => requirement.conditions.some(
            condition => memberships.some(membership => passesCondition(membership, condition))
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

function passesCondition(membership: MembershipFiltered, condition: VisibilityCondition) {
    return membership.groupId === condition.groupId
        && (condition.order === null || membership.order === condition.order)
        && (!condition.onlyActive || membership.active)
        && (!condition.onlyAdmins || membership.admin)
}
