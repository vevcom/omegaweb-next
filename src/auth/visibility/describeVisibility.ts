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

/** Who a VisibilityMatrix lets in, as a sentence for those who do not think in requirements. */
export function describeAudience(visibility: VisibilityMatrix, groups: ExpandedGroup[] | null): string {
    if (visibility.requirements.length === 0) return 'Alle'
    return visibility.requirements
        .map(requirement => requirement.conditions.map(condition => describeGroup(condition, groups)).join(' eller '))
        .join(', som også er i ')
}
