import { GroupType } from '@/prisma-generated-pn-types'

/**
 * Which group types follow omega's order without a human in the loop. When omega increments, every
 * group of these types is brought along to the new order immediately - their memberships are left
 * where they are, so a user keeps the active membership of the order they got it in.
 *
 * The rest are migrated one group at a time by someone picking which members carry over, through
 * that group type's own migration operation. Omega cannot increment again until they have all
 * caught up - see `omegaOrderOperations.readRequirements`.
 */
export const MigratedStraightAwayOnIncrement = {
    CLASS: true,
    COMMITTEE: false,
    INTEREST_GROUP: false,
    MANUAL_GROUP: false,
    OMEGA_MEMBERSHIP_GROUP: true,
    STUDY_PROGRAMME: true,
    REVUE_SUB_GROUP: false,
} as const satisfies Record<GroupType, boolean>

export const groupTypesMigratedStraightAway = Object.values(GroupType)
    .filter(groupType => MigratedStraightAwayOnIncrement[groupType])
