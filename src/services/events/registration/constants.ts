import { userCardSelection } from '@/services/users/constants'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const eventRegistrationSelection = {
    id: true,
    user: {
        select: {
            ...userCardSelection,
            image: { include: expandedImageIncluder },
        },
    },
    contact: {
        select: {
            name: true,
        },
    }
} satisfies Prisma.EventRegistrationSelect

/**
 * The order registrations queue in for the places of an event: the ones registered first take the
 * places, and the ones past them queue on the waiting list. The autoincremented id is the order
 * they were registered in, and being unique it is a total order - so it also cursor-pages cleanly.
 */
export const eventRegistrationQueueOrder = {
    id: 'asc',
} as const satisfies Prisma.EventRegistrationOrderByWithRelationInput

export const eventRegistrationSelectionDetailed = {
    id: true,
    note: true,
    attendedAt: true,
    user: {
        select: {
            ...userCardSelection,
            email: true,
            mobile: true,
            allergies: true,
        },
    },
    contact: true,
} satisfies Prisma.EventRegistrationSelect

export enum REGISTRATION_READER_TYPE {
    REGISTRATIONS = 'REGISTRATIONS',
    WAITING_LIST = 'WAITING_LIST',
}

/**
 * One registration as the attendance tools read it back: who it is for, so a scan can be echoed
 * with the name of the one scanned, and whether attendance has been taken for them.
 */
export const eventRegistrationAttendanceSelection = {
    id: true,
    eventId: true,
    attendedAt: true,
    note: true,
    user: {
        select: userCardSelection,
    },
    contact: {
        select: {
            name: true,
        },
    },
} satisfies Prisma.EventRegistrationSelect
