import { findGroup } from '@/lib/groups/groupOptions'
import type { VisibilityCondition, VisibilityMatrix } from '@/services/visibility/types'
import type { ExpandedGroup } from '@/services/groups/types'

function describeCondition(condition: VisibilityCondition, groups: ExpandedGroup[] | null): string {
    const groupName = findGroup(groups, condition.groupId)?.name ?? `gruppe #${condition.groupId}`
    return condition.type === 'ACTIVE' ? groupName : `${groupName} i orden ${condition.order}`
}

function listNames(names: string[]) {
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} eller ${names[names.length - 1]}`
}

/**
 * Who passes a visibility, in words: "Alle", "Ingen", or the groups, as in "Arrkom eller Styret som
 * også er i 3. klasse". Every place that says who a visibility lets in says it with this. `everyone`
 * is for a rule that asks more than the visibility of those who pass one without requirements, such
 * as "Alle som er logget inn" where it takes a user.
 */
export function describeVisibility(
    visibility: VisibilityMatrix,
    groups: ExpandedGroup[] | null,
    { everyone = 'Alle' }: { everyone?: string } = {},
): string {
    if (visibility.requirements.length === 0) return everyone
    // A list with no groups in it passes no one.
    if (visibility.requirements.some(requirement => requirement.conditions.length === 0)) return 'Ingen'
    return visibility.requirements
        .map(requirement => listNames(requirement.conditions.map(condition => describeCondition(condition, groups))))
        .join(' som også er i ')
}

/** Someone is only in one class at a time, so lists of nothing but classes must share a class to all pass. */
export function listsContradict(visibility: VisibilityMatrix, groups: ExpandedGroup[] | null): boolean {
    const classLists = visibility.requirements.filter(({ conditions }) => (
        conditions.length > 0 && conditions.every(condition => (
            condition.type === 'ACTIVE' && findGroup(groups, condition.groupId)?.groupType === 'CLASS'
        ))
    ))
    if (classLists.length < 2) return false
    return !classLists[0].conditions.some(({ groupId }) => classLists.every(
        ({ conditions }) => conditions.some(condition => condition.groupId === groupId)
    ))
}
