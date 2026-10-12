import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma, SEX } from '@/prisma-generated-pn-types'

export const maxNumberOfGroupsInFilter = 7

export const defaultSearchResultLimit = 5

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
} as const satisfies { [key in SEX]: { title: string, pronoun: string, label: string } }

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
