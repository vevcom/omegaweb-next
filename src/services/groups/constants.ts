import { createSelection } from '@/services/createSelection'
import { userCardSelection } from '@/services/users/constants'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { ClassLevel, GroupType, Membership, OmegaMembershipLevel, Prisma } from '@/prisma-generated-pn-types'
import type { GroupTypeInfo } from './types'

/**
 * A object that describes the different group types in a friendly way
 */
export const groupTypesConfig = {
    OMEGA_MEMBERSHIP_GROUP: {
        name: 'Medlemsgruppe',
        namePlural: 'Medlemsgrupper',
        description: 'Grupper som beskriver hvilken tilknytning en bruker har til sct. Omega Broderskab'
    },
    CLASS: {
        name: 'Klasse',
        namePlural: 'Klasser',
        description: 'Klasse på universitetet'
    },
    STUDY_PROGRAMME: {
        name: 'Studieprogram',
        namePlural: 'Studieprogrammer',
        description: 'Studieprogram på NTNU'
    },
    COMMITTEE: {
        name: 'Komité',
        namePlural: 'Komitéer',
        description: 'Komitér i sct. Omega Broderskab'
    },
    INTEREST_GROUP: {
        name: 'Interessegruppe',
        namePlural: 'Interessegrupper',
        description: 'Interessegrupper i sct. Omega Broderskab'
    },
    MANUAL_GROUP: {
        name: 'Andre grupper',
        namePlural: 'Andre grupper',
        description: 'øvrige grupper'
    }
} as const satisfies {
    [key in GroupType]: GroupTypeInfo
}

/**
 * The class levels in the order a user moves through them. The class bump moves a user to the next
 * level in this list; GRADUATED is last and terminal.
 */
export const CLASS_LEVEL_ORDERING = [
    'ONE',
    'TWO',
    'THREE',
    'FOUR',
    'FIVE',
    'GRADUATED',
] as const satisfies readonly ClassLevel[]

export const ClassLevelConfig = {
    ONE: { name: '1. Klasse' },
    TWO: { name: '2. Klasse' },
    THREE: { name: '3. Klasse' },
    FOUR: { name: '4. Klasse' },
    FIVE: { name: '5. Klasse' },
    GRADUATED: { name: 'Uteksaminert' },
} as const satisfies Record<ClassLevel, { name: string }>

export const OmegaMembershipLevelConfig = {
    SOELLE: {
        name: 'Solle noice',
        description: 'Avsky!'
    },
    SYSKEN: {
        name: 'Medlem',
        description: 'Broder udaf sct. Omega Broderskab'
    },
    DEN_GEMENE_HOB: {
        name: 'Eksterne',
        description: 'Ekstern bruker ikke i omega'
    }
} as const satisfies {
    [key in OmegaMembershipLevel]: {
        name: string,
        description: string
    }
}

export const OMEGA_MEMBERSHIP_LEVEL_RANKING: OmegaMembershipLevel[] = [
    'DEN_GEMENE_HOB',
    'SOELLE',
    'SYSKEN',
]

export const groupsWithRelationsIncluder = {
    committee: { select: { name: true } },
    manualGroup: { select: { name: true } },
    class: { select: { level: true } },
    interestGroup: { select: { name: true } },
    omegaMembershipGroup: { select: { omegaMembershipLevel: true } },
    studyProgramme: { select: { name: true } },
} as const satisfies Prisma.GroupInclude

export const groupsExpandedIncluder = {
    ...groupsWithRelationsIncluder,
    memberships: {
        take: 1,
        orderBy: {
            order: 'asc'
        },
        select: {
            order: true
        }
    },
} as const satisfies Prisma.GroupInclude

export const readGroupsOfUserIncluder = {
    class: true,
    committee: true,
    interestGroup: true,
    manualGroup: true,
    omegaMembershipGroup: true,
    studyProgramme: true,

} as const satisfies Prisma.GroupInclude

export const membershipFieldsToExpose = [
    'active',
    'order',
    'groupId',
    'admin'
] as const satisfies (keyof Membership)[]
export const membershipFilterSelection = createSelection([...membershipFieldsToExpose])

/**
 * A membership together with the user it belongs to, as the common `readMembers` operation
 * returns it. The profile image is resolved against the default profile image at read time.
 */
export const groupMembershipIncluder = {
    user: {
        select: {
            ...userCardSelection,
            image: { include: expandedImageIncluder },
        }
    }
} as const satisfies Prisma.MembershipInclude
