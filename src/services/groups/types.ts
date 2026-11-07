import type { membershipFieldsToExpose } from './constants'
import type { groupOperations } from './operations'
import type { ActionFromSubServiceOperation } from '@/services/actionTypes'
import type {
    Class,
    Committee,
    Group,
    GroupType,
    InterestGroup,
    ManualGroup,
    Membership,
    OmegaMembershipGroup,
    StudyProgramme
} from '@/prisma-generated-pn-types'

type PartialNullable<T> = {
    [P in keyof T]?: T[P] | null;
};

/**
 * Dumb type that holds all possible relation to types of groups
 */
export type GroupWithDumbRelations<
    CommitteeKeys extends keyof Committee,
    ManualGroupKeys extends keyof ManualGroup,
    ClassKeys extends keyof Class,
    InterestGroupKeys extends keyof InterestGroup,
    OmegaMembershipGroupKeys extends keyof OmegaMembershipGroup,
    StudyProgrammeKeys extends keyof StudyProgramme
> = Group & PartialNullable<{
    committee: Pick<Committee, CommitteeKeys>,
    manualGroup: Pick<ManualGroup, ManualGroupKeys>,
    class: Pick<Class, ClassKeys>,
    interestGroup: Pick<InterestGroup, InterestGroupKeys>,
    omegaMembershipGroup: Pick<OmegaMembershipGroup, OmegaMembershipGroupKeys>,
    studyProgramme: Pick<StudyProgramme, StudyProgrammeKeys>,
}>

/**
 * Type that holds a relation to spesific gruptype based on the groupType atribute
 */
export type GroupWithRelations<
    CommitteeKeys extends keyof Committee,
    ManualGroupKeys extends keyof ManualGroup,
    ClassKeys extends keyof Class,
    InterestGroupKeys extends keyof InterestGroup,
    OmegaMembershipGroupKeys extends keyof OmegaMembershipGroup,
    StudyProgrammeKeys extends keyof StudyProgramme
> = Omit<Group, 'groupType'> & ({
    groupType: 'COMMITTEE',
    committee: Pick<Committee, CommitteeKeys>
} | {
    groupType: 'MANUAL_GROUP',
    manualGroup: Pick<ManualGroup, ManualGroupKeys>
} |
{
    groupType: 'CLASS',
    class: Pick<Class, ClassKeys>
} |
{
    groupType: 'INTEREST_GROUP',
    interestGroup: Pick<InterestGroup, InterestGroupKeys>
} |
{
    groupType: 'OMEGA_MEMBERSHIP_GROUP',
    omegaMembershipGroup: Pick<OmegaMembershipGroup, OmegaMembershipGroupKeys>
} |
{
    groupType: 'STUDY_PROGRAMME',
    studyProgramme: Pick<StudyProgramme, StudyProgrammeKeys>
})

export type GroupWithRelationsNameInferencer = GroupWithRelations<
    'name', 'name', 'level', 'name', 'omegaMembershipLevel', 'name'
>

/**
 * Explains meta info about one grouptype like class: klasse, klasser, klassene på NTNU.
*/
export type GroupTypeInfo = {
    name: string,
    namePlural: string,
    description: string
}

/**
 * Type including extra infered fields based on the type of group and the group data
 */
export type ExpandedGroup = Group & {
    firstOrder: number
    name: string
    members: number
}


export type MembershipFiltered = Pick<Membership, typeof membershipFieldsToExpose[number]>

/**
 * This type is ment to abstract away selecting memberships on order.
 * - A number means a spesific order
 * - ACTIVE means all active memberships (regardless of order)
 * - ALL means all active and inactive of all orders.
 */
export type MembershipSelectorType = number | 'ACTIVE' | 'ALL'

/**
 * The expanded groups of every group type, as the client side group cache holds them. A group type
 * the session may not read is `null` rather than an empty list, so that "no access" stays
 * distinguishable from "none exist".
 */
export type ExpandedGroupsOfAllTypes = Record<GroupType, ExpandedGroup[] | null>

/**
 * The action every group type that migrates one group at a time exposes. All three of them implement
 * the same underlying sub-operation, so a single type covers committees, interest groups and manual
 * groups - which is what lets one component drive the migration of any of them.
 */
export type MigrateGroupAction = ActionFromSubServiceOperation<typeof groupOperations.migrateGroup>

/**
 * The action reading the members of one group, shared by every group type for the same reason.
 */
export type ReadGroupMembersAction = ActionFromSubServiceOperation<typeof groupOperations.readMembers>

/**
 * The member management actions of the group types that let members simply be added and removed.
 * As with migration they all implement the same underlying sub-operations, so one component can
 * drive any of them.
 */
export type AddGroupMembersAction = ActionFromSubServiceOperation<typeof groupOperations.addMembers>
export type RemoveGroupMembersAction = ActionFromSubServiceOperation<typeof groupOperations.removeMembers>
export type SetGroupMemberAdminAction = ActionFromSubServiceOperation<typeof groupOperations.setMemberAdmin>
export type SetGroupMemberTitleAction = ActionFromSubServiceOperation<typeof groupOperations.setMemberTitle>
export type ReorderGroupMembersAction = ActionFromSubServiceOperation<typeof groupOperations.reorderMembers>

/**
 * The action retiring a group or bringing it back, shared by the group types that are migrated
 * by hand - they are the only ones that can be pensioned.
 */
export type PensionGroupAction = ActionFromSubServiceOperation<typeof groupOperations.pension>
