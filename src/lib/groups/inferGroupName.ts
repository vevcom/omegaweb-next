import { ClassLevelConfig, OmegaMembershipLevelConfig } from '@/services/groups/constants'
import type { GroupWithDumbRelations, GroupWithRelationsNameInferencer } from '@/services/groups/types'

/**
 * Gives a group a display name based on its group type and the matching type-specific relation.
 */
export function inferGroupName(group: GroupWithRelationsNameInferencer): string {
    return inferGroupNameIfValid(group) ?? 'Group with unknown name'
}

/**
 * The display name of a group whose relations are all included but may be missing, or null when the
 * relation its group type needs is not there. Safe in client components, unlike checkGroupValidity,
 * which logs an invalid group on the server.
 */
export function inferGroupNameIfValid(
    group: GroupWithDumbRelations<'name', 'name', 'level', 'name', 'omegaMembershipLevel', 'name'>
): string | null {
    switch (group.groupType) {
        case 'COMMITTEE':
            return group.committee?.name ?? null
        case 'MANUAL_GROUP':
            return group.manualGroup?.name ?? null
        case 'CLASS':
            return group.class ? ClassLevelConfig[group.class.level].name : null
        case 'INTEREST_GROUP':
            return group.interestGroup?.name ?? null
        case 'OMEGA_MEMBERSHIP_GROUP':
            return group.omegaMembershipGroup
                ? OmegaMembershipLevelConfig[group.omegaMembershipGroup.omegaMembershipLevel].name
                : null
        case 'STUDY_PROGRAMME':
            return group.studyProgramme?.name ?? null
        default:
            return null
    }
}
