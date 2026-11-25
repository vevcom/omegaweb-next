import { findGroup } from '@/lib/groups/groupOptions'
import type { VisibilityCondition, VisibilityMatrix } from '@/services/visibility/types'
import type { ExpandedGroup } from '@/services/groups/types'
import type { GroupType } from '@/prisma-generated-pn-types'

/**
 * The group types of which someone holds one group at a time among their active memberships, and
 * where `perOrder` one group at each order too, with what the editor warns of a list that asks for two.
 */
const heldOneAtATime: Partial<Record<GroupType, { perOrder: boolean, warning: string }>> = {
    CLASS: {
        perOrder: true,
        warning: 'Ingen går i to klasser samtidig. Skal begge klassene med, legg dem i samme liste.',
    },
}

/**
 * Who passes a visibility, in words: "Alle", "Ingen", or the groups, as in "Arrkom (aktive) eller
 * Styret (108. orden) som også er i 3. klasse (aktive)". Every place that says who a visibility lets
 * in says it with this. `everyone` is for a rule that asks more than the visibility of those who
 * pass one without requirements, such as "Alle som er logget inn" where it takes a user.
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
        .map(requirement => listNames(requirement.conditions.map(condition => (
            `${groupNameOf(condition, groups)} (${describeMemberships(condition)})`
        ))))
        .join(' som også er i ')
}

/**
 * Which memberships of its group a condition lets in, as in "aktive", "108. orden" or "107. orden,
 * aktive administratorer". "alle ordener" is said only where nothing narrows the order, since the
 * active members are of any order already.
 */
export function describeMemberships({ order, onlyActive, onlyAdmins }: VisibilityCondition): string {
    const orderPart = order !== null ? `${order}. orden` : !onlyActive && 'alle ordener'
    const whoPart = [onlyActive && 'aktive', onlyAdmins && 'administratorer'].filter(Boolean).join(' ')
    return [orderPart, whoPart].filter(Boolean).join(', ')
}

export function groupNameOf(condition: VisibilityCondition, groups: ExpandedGroup[] | null) {
    return findGroup(groups, condition.groupId)?.name ?? `gruppe #${condition.groupId}`
}

/** What the editor warns of a visibility that lets no one in, though it can still be saved. */
export function visibilityWarnings(visibility: VisibilityMatrix, groups: ExpandedGroup[] | null): string[] {
    return contradictingListsWarnings(visibility, groups)
}

function listNames(names: string[]) {
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} eller ${names[names.length - 1]}`
}

/**
 * Someone holds one class at a time, so lists of nothing but classes must share a class to all pass.
 * That holds for lists of the active members, and for lists of one and the same order.
 */
function contradictingListsWarnings(visibility: VisibilityMatrix, groups: ExpandedGroup[] | null) {
    const listsBySlot = new Map<string, { warning: string, lists: VisibilityCondition[][] }>()
    visibility.requirements.forEach(({ conditions }) => {
        const slots = conditions.map(condition => slotOf(condition, groups))
        const slot = slots[0]
        if (!slot || slots.some(other => other?.key !== slot.key)) return
        const entry = listsBySlot.get(slot.key) ?? { warning: slot.warning, lists: [] }
        listsBySlot.set(slot.key, { ...entry, lists: [...entry.lists, conditions] })
    })
    const warnings = Array.from(listsBySlot.values()).filter(({ lists }) => lists.length > 1 && !lists[0].some(
        ({ groupId }) => lists.every(conditions => conditions.some(condition => condition.groupId === groupId))
    )).map(({ warning }) => warning)
    return Array.from(new Set(warnings))
}

/** The one group of a type someone can be in at a time that a condition asks for, if it asks for one. */
function slotOf(condition: VisibilityCondition, groups: ExpandedGroup[] | null) {
    const groupType = findGroup(groups, condition.groupId)?.groupType
    const rule = groupType && heldOneAtATime[groupType]
    if (!rule) return null
    if (condition.onlyActive) return { key: `${groupType}-active`, warning: rule.warning }
    if (condition.order !== null && rule.perOrder) return { key: `${groupType}-${condition.order}`, warning: rule.warning }
    return null
}
