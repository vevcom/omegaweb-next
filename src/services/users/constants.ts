import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma, Sex } from '@/prisma-generated-pn-types'
import type { UserPartition } from './types'

export const maxNumberOfGroupsInFilter = 7

export const defaultSearchResultLimit = 5

/**
 * The levels of who a read of users covers, as user filters. Reads that any member may run
 * cover the active omega students: users who are in a class and admitted. Reads of everyone
 * except the archived users are for admins and for server code resolving recipients and owners.
 * Only reads that ask for archived users get them.
 */
export const userPartitions = {
    activeOmegaStudents: {
        archived: false,
        memberships: {
            some: {
                active: true,
                group: { class: { level: { in: ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'] } } },
            },
        },
        AND: {
            memberships: {
                some: {
                    active: true,
                    group: { omegaMembershipGroup: { omegaMembershipLevel: { in: ['SOELLE', 'SYSKEN'] } } },
                },
            },
        },
    },
    unarchived: {
        archived: false,
    },
    archived: {
        archived: true,
    },
} as const satisfies Record<UserPartition, Prisma.UserWhereInput>

export const userBasicSelection = {
    id: true,
    username: true,
    firstname: true,
    lastname: true,
} as const satisfies Prisma.UserSelect

export const userCardSelection = {
    ...userBasicSelection,
    flairs: {
        select: {
            id: true,
            rank: true,
            colorR: true,
            colorG: true,
            colorB: true,
            image: { include: expandedImageIncluder },
        },
    },
} as const satisfies Prisma.UserSelect

/**
 * What a member may see of another member.
 */
export const userProfileSelection = {
    ...userCardSelection,
    email: true,
    sex: true,
    relationshipStatus: true,
    relationshipStatusText: true,
} as const satisfies Prisma.UserSelect

/**
 * Only for the user themselves and USERS_ADMIN.
 */
export const userPrivateSelection = {
    ...userProfileSelection,
    theme: true,
    mobile: true,
    emailVerified: true,
    acceptedTerms: true,
    allergies: true,
    studentCard: true,
    imageConsent: true,
    createdAt: true,
    updatedAt: true,
} as const satisfies Prisma.UserSelect

export const standardMembershipSelection = [
    {
        group: {
            groupType: 'CLASS'
        }
    },
    {
        group: {
            groupType: 'OMEGA_MEMBERSHIP_GROUP'
        }
    },
    {
        group: {
            groupType: 'STUDY_PROGRAMME'
        }
    },
] satisfies Prisma.MembershipWhereInput[]


export const sexConfig = {
    MALE: {
        title: 'Broder',
        pronoun: 'Hands',
        label: 'Mann',
    },
    FEMALE: {
        title: 'Syster',
        pronoun: 'Hendes',
        label: 'Kvinne',
    },
    OTHER: {
        title: 'Sysken',
        pronoun: 'Hends',
        label: 'Annet',
    }
} as const satisfies Record<Sex, { title: string, pronoun: string, label: string }>

export const relationshipStatusConfig = {
    SINGLE: {
        label: 'Singel'
    },
    TAKEN: {
        label: 'I et forhold'
    },
    ITS_COMPLICATED: {
        label: 'Det er komplisert'
    },
    NOT_SPECIFIED: {
        label: 'Ikke spesifisert'
    }
}
