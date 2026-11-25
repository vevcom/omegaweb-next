import { findGroup } from '@/lib/groups/groupOptions'
import { conditionKey } from '@/services/visibility/conditionKey'
import type { ExpandedGroup } from '@/services/groups/types'
import type { VisibilityCondition } from '@/services/visibility/types'

/**
 * What a group picked in a visibility's editor starts as: the memberships of `order`, of any order
 * when it is null, or of the group's own current order, which need not be Omega's, and only the
 * active ones when `onlyActive`. It never starts as only the admins. Each owner states it for each of
 * its visibilities.
 */
export type DefaultMembershipRequirement = {
    order: number | null | 'CURRENT_GROUP_ORDER',
    onlyActive: boolean,
}

/**
 * The conditions of a list with the groups picked in it. A group is picked when the list holds it as
 * a new pick would put it, so picking one that is there in another form adds it beside that form.
 */
export function withPickedGroups(
    conditions: VisibilityCondition[],
    groupIds: number[],
    groups: ExpandedGroup[],
    defaultRequirement: DefaultMembershipRequirement,
): VisibilityCondition[] {
    return withoutRepeats([
        ...conditions.filter(condition => (
            groupIds.includes(condition.groupId) || !isAsPicked(condition, groups, defaultRequirement)
        )),
        ...groupIds.flatMap(groupId => {
            const group = findGroup(groups, groupId)
            return group ? [conditionOfPickedGroup(group, defaultRequirement)] : []
        }),
    ])
}

/** The groups of a list that are there as a pick would put them, which the panel shows as picked. */
export function pickedGroupIds(
    conditions: VisibilityCondition[],
    groups: ExpandedGroup[],
    defaultRequirement: DefaultMembershipRequirement,
): number[] {
    return conditions
        .filter(condition => isAsPicked(condition, groups, defaultRequirement))
        .map(({ groupId }) => groupId)
}

/** A condition changed into what another already says leaves one of them. */
export function withoutRepeats(conditions: VisibilityCondition[]) {
    return Array.from(new Map(conditions.map(condition => [conditionKey(condition), condition])).values())
}

function conditionOfPickedGroup(
    group: ExpandedGroup,
    { order, onlyActive }: DefaultMembershipRequirement,
): VisibilityCondition {
    return { groupId: group.id, order: order === 'CURRENT_GROUP_ORDER' ? group.order : order, onlyActive, onlyAdmins: false }
}

function isAsPicked(
    condition: VisibilityCondition,
    groups: ExpandedGroup[],
    defaultRequirement: DefaultMembershipRequirement,
) {
    const group = findGroup(groups, condition.groupId)
    return group !== undefined && conditionKey(condition) === conditionKey(conditionOfPickedGroup(group, defaultRequirement))
}
