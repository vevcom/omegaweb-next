import { findGroup } from '@/lib/groups/groupOptions'
import type { VisibilityCondition, VisibilityMatrix } from '@/services/visibility/types'
import type { ExpandedGroup } from '@/services/groups/types'

function describeCondition(condition: VisibilityCondition, groups: ExpandedGroup[] | null): string {
    const groupName = findGroup(groups, condition.groupId)?.name ?? `gruppe #${condition.groupId}`
    return condition.type === 'ACTIVE' ? `aktiv i ${groupName}` : `var i ${groupName} i orden ${condition.order}`
}

/**
 * A human readable Norwegian description of a VisibilityMatrix, e.g. for showing who can see or
 * administrate a resource. Group names are resolved from `groups` (falling back to the raw id
 * when a group can't be found there).
 */
export function describeMatrix(visibility: VisibilityMatrix, groups: ExpandedGroup[] | null): string {
    if (visibility.requirements.length === 0) return 'Synlig for alle.'
    const requirementDescriptions = visibility.requirements.map(requirement =>
        requirement.conditions.map(condition => describeCondition(condition, groups)).join(' ELLER ')
    )
    return `Krever: ${requirementDescriptions.map(description => `(${description})`).join(' OG ')}`
}

function describeGroup(condition: VisibilityCondition, groups: ExpandedGroup[] | null): string {
    const groupName = findGroup(groups, condition.groupId)?.name ?? `gruppe #${condition.groupId}`
    return condition.type === 'ACTIVE' ? groupName : `${groupName} i orden ${condition.order}`
}

function listNames(names: string[]) {
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} eller ${names[names.length - 1]}`
}

/** Who a VisibilityMatrix lets in, as a sentence for those who do not think in requirements. */
export function describeAudience(visibility: VisibilityMatrix, groups: ExpandedGroup[] | null): string {
    if (visibility.requirements.length === 0) return 'Alle'
    // A list with no groups in it passes no one.
    if (visibility.requirements.some(requirement => requirement.conditions.length === 0)) return 'Ingen'
    return visibility.requirements
        .map(requirement => listNames(requirement.conditions.map(condition => describeGroup(condition, groups))))
        .join(' som også er i ')
}

/** Who gets in, as a whole sentence. `everyone` is what no requirements means where that can be chosen. */
export function describeAccess(
    visibility: VisibilityMatrix,
    groups: ExpandedGroup[] | null,
    { verb, everyone }: { verb: string, everyone?: string },
): string {
    if (visibility.requirements.length === 0) return everyone ? `${everyone} ${verb}.` : 'Velg minst én gruppe.'
    if (visibility.requirements.some(requirement => requirement.conditions.length === 0)) return 'Velg minst én gruppe.'
    return `${describeAudience(visibility, groups)} ${verb}.`
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
