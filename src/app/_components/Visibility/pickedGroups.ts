import { findGroup } from '@/lib/groups/groupOptions'
import type { ExpandedGroup } from '@/services/groups/types'
import type { VisibilityCondition } from '@/services/visibility/types'

/**
 * What a group picked in a visibility's editor starts as: its active members, or the members of
 * its newest order, which is the group's own order and not necessarily Omega's. Each owner states
 * it for each of its visibilities.
 */
export type PickedGroupStartsAs = 'ACTIVE' | 'NEWEST_ORDER'

/** The conditions of a list with the groups picked in it, each new one as `startsAs` says. */
export function withPickedGroups(
    conditions: VisibilityCondition[],
    groupIds: number[],
    groups: ExpandedGroup[],
    startsAs: PickedGroupStartsAs,
): VisibilityCondition[] {
    return withoutRepeats([
        ...conditions.filter(condition => (
            groupIds.includes(condition.groupId) || !isAsPicked(condition, groups, startsAs)
        )),
        ...groupIds.flatMap(groupId => {
            const group = findGroup(groups, groupId)
            return group ? [conditionOfPickedGroup(group, startsAs)] : []
        }),
    ])
}

/** The groups of a list that are there as a pick would put them, which are the ones shown as picked. */
export function pickedGroupIds(
    conditions: VisibilityCondition[],
    groups: ExpandedGroup[],
    startsAs: PickedGroupStartsAs,
): number[] {
    return conditions.filter(condition => isAsPicked(condition, groups, startsAs)).map(({ groupId }) => groupId)
}

/** A condition changed into what another already says leaves one of them. */
export function withoutRepeats(conditions: VisibilityCondition[]) {
    return Array.from(new Map(conditions.map(condition => [conditionKey(condition), condition])).values())
}

function conditionOfPickedGroup(group: ExpandedGroup, startsAs: PickedGroupStartsAs): VisibilityCondition {
    return startsAs === 'ACTIVE'
        ? { type: 'ACTIVE', groupId: group.id }
        : { type: 'ORDER', groupId: group.id, order: group.order }
}

function isAsPicked(condition: VisibilityCondition, groups: ExpandedGroup[], startsAs: PickedGroupStartsAs) {
    const group = findGroup(groups, condition.groupId)
    return group !== undefined && conditionKey(condition) === conditionKey(conditionOfPickedGroup(group, startsAs))
}

function conditionKey(condition: VisibilityCondition) {
    return condition.type === 'ORDER' ? `${condition.groupId}-${condition.order}` : `${condition.groupId}`
}
