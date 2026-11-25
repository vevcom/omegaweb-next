import logger from '@/lib/logger'
import type { GroupWithDumbRelations, GroupWithRelations, RevueSubGroupWithRevueGroup } from '@/services/groups/types'
import type {
    Class, Committee, InterestGroup, ManualGroup, OmegaMembershipGroup, StudyProgramme
} from '@/prisma-generated-pn-types'

export type ValidatedGroup<
    CommitteeKeys extends keyof Committee,
    ManualGroupKeys extends keyof ManualGroup,
    ClassKeys extends keyof Class,
    InterestGroupKeys extends keyof InterestGroup,
    OmegaMembershipGroupKeys extends keyof OmegaMembershipGroup,
    StudyProgrammeKeys extends keyof StudyProgramme,
    RevueSubGroupKeys extends keyof RevueSubGroupWithRevueGroup,
    ExtraFields extends object,
> = GroupWithRelations<
    CommitteeKeys,
    ManualGroupKeys,
    ClassKeys,
    InterestGroupKeys,
    OmegaMembershipGroupKeys,
    StudyProgrammeKeys,
    RevueSubGroupKeys
> & Omit<
    ExtraFields,
    'committee' | 'manualGroup' | 'class' | 'interestGroup' | 'omegaMembershipGroup' | 'studyProgramme' | 'revueSubGroup'
>

export type GroupValidityCheck<
    CommitteeKeys extends keyof Committee,
    ManualGroupKeys extends keyof ManualGroup,
    ClassKeys extends keyof Class,
    InterestGroupKeys extends keyof InterestGroup,
    OmegaMembershipGroupKeys extends keyof OmegaMembershipGroup,
    StudyProgrammeKeys extends keyof StudyProgramme,
    RevueSubGroupKeys extends keyof RevueSubGroupWithRevueGroup,
    ExtraFields extends object,
> =
    | {
        valid: true,
        group: ValidatedGroup<
            CommitteeKeys, ManualGroupKeys, ClassKeys, InterestGroupKeys, OmegaMembershipGroupKeys,
            StudyProgrammeKeys, RevueSubGroupKeys, ExtraFields
        >,
    }
    | { valid: false }

/**
 * WARNING: Make sure that you have actually included the relations in the query.
 * Checks that the group has a relation matching the group type it claims to have. Pure - never
 * throws - so it stays reusable regardless of how a caller wants to handle an invalid group.
 * Callers that just want the old throw-or-continue behaviour should use `assertGroupValidity`
 * from `@/services/groups/operations` instead.
 * @param group - The group to check the validity of
 * @returns - Whether the group is valid, and if so, the group with the correct relation (better typing)
 */
export function checkGroupValidity<
    CommitteeKeys extends keyof Committee,
    ManualGroupKeys extends keyof ManualGroup,
    ClassKeys extends keyof Class,
    InterestGroupKeys extends keyof InterestGroup,
    OmegaMembershipGroupKeys extends keyof OmegaMembershipGroup,
    StudyProgrammeKeys extends keyof StudyProgramme,
    RevueSubGroupKeys extends keyof RevueSubGroupWithRevueGroup,
    ExtraFields extends object,
>(group: GroupWithDumbRelations<
    CommitteeKeys,
    ManualGroupKeys,
    ClassKeys,
    InterestGroupKeys,
    OmegaMembershipGroupKeys,
    StudyProgrammeKeys,
    RevueSubGroupKeys
> & ExtraFields): GroupValidityCheck<
    CommitteeKeys, ManualGroupKeys, ClassKeys, InterestGroupKeys, OmegaMembershipGroupKeys, StudyProgrammeKeys,
    RevueSubGroupKeys, ExtraFields
> {
    switch (group.groupType) {
        case 'COMMITTEE':
            if (!group.committee) {
                logger.error(
                    'Group with type committee without committee relation detected',
                    group
                )
                return { valid: false }
            }
            return {
                valid: true,
                group: {
                    ...group,
                    groupType: 'COMMITTEE',
                    committee: group.committee,
                }
            }
        case 'MANUAL_GROUP':
            if (!group.manualGroup) {
                logger.error(
                    'Group with type manual group without manual group relation detected',
                    group
                )
                return { valid: false }
            }
            return {
                valid: true,
                group: {
                    ...group,
                    groupType: 'MANUAL_GROUP',
                    manualGroup: group.manualGroup,
                }
            }
        case 'CLASS':
            if (!group.class) {
                logger.error(
                    'Group with type class without class relation detected',
                    group
                )
                return { valid: false }
            }
            return {
                valid: true,
                group: {
                    ...group,
                    groupType: 'CLASS',
                    class: group.class,
                }
            }
        case 'INTEREST_GROUP':
            if (!group.interestGroup) {
                logger.error(
                    'Group with type interest group without interest group relation detected',
                    group
                )
                return { valid: false }
            }
            return {
                valid: true,
                group: {
                    ...group,
                    groupType: 'INTEREST_GROUP',
                    interestGroup: group.interestGroup,
                }
            }
        case 'OMEGA_MEMBERSHIP_GROUP':
            if (!group.omegaMembershipGroup) {
                logger.error(
                    'Group with type omega membership group without omega membership group relation detected',
                    group
                )
                return { valid: false }
            }
            return {
                valid: true,
                group: {
                    ...group,
                    groupType: 'OMEGA_MEMBERSHIP_GROUP',
                    omegaMembershipGroup: group.omegaMembershipGroup,
                }
            }
        case 'STUDY_PROGRAMME':
            if (!group.studyProgramme) {
                logger.error(
                    'Group with type study programme without study programme relation detected',
                    group
                )
                return { valid: false }
            }
            return {
                valid: true,
                group: {
                    ...group,
                    groupType: 'STUDY_PROGRAMME',
                    studyProgramme: group.studyProgramme,
                }
            }
        case 'REVUE_SUB_GROUP':
            if (!group.revueSubGroup) {
                logger.error(
                    'Group with type revue sub group without revue sub group relation detected',
                    group
                )
                return { valid: false }
            }
            return {
                valid: true,
                group: {
                    ...group,
                    groupType: 'REVUE_SUB_GROUP',
                    revueSubGroup: group.revueSubGroup,
                }
            }
        default:
            logger.error('Group with unknown group type detected', group)
            return { valid: false }
    }
}
