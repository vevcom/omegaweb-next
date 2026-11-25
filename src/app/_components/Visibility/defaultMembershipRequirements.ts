import type { DefaultMembershipRequirement, DefaultMembershipRequirements } from './pickedGroups'

const ofCurrentGroupOrder: DefaultMembershipRequirement = { order: 'CURRENT_GROUP_ORDER', onlyActive: false }
const activeOfAnyOrder: DefaultMembershipRequirement = { order: null, onlyActive: true }

/**
 * For a visibility of who sees or signs up. A membership group and a study programme move on to a new
 * order every year while each member stays active in the order they joined in, so the group's own
 * order would leave out all but the newest members.
 */
export const regularDefaultMembershipRequirements = {
    CLASS: ofCurrentGroupOrder,
    COMMITTEE: ofCurrentGroupOrder,
    INTEREST_GROUP: ofCurrentGroupOrder,
    MANUAL_GROUP: ofCurrentGroupOrder,
    OMEGA_MEMBERSHIP_GROUP: activeOfAnyOrder,
    STUDY_PROGRAMME: activeOfAnyOrder,
    REVUE_SUB_GROUP: ofCurrentGroupOrder,
} satisfies DefaultMembershipRequirements

/** For a visibility of who administers or changes something, and of those a notification is sent to at once. */
export const adminDefaultMembershipRequirements = {
    CLASS: activeOfAnyOrder,
    COMMITTEE: activeOfAnyOrder,
    INTEREST_GROUP: activeOfAnyOrder,
    MANUAL_GROUP: activeOfAnyOrder,
    OMEGA_MEMBERSHIP_GROUP: activeOfAnyOrder,
    STUDY_PROGRAMME: activeOfAnyOrder,
    REVUE_SUB_GROUP: activeOfAnyOrder,
} satisfies DefaultMembershipRequirements
