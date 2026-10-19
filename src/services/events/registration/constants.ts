import { userBasicSelection, userCardSelection } from '@/services/users/constants'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
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
    ledgerTransactions: {
        where: validTransactionFilter,
        select: { id: true },
    },
} satisfies Prisma.EventRegistrationSelect

/**
 * The most dots that may be given at once to everyone who did not show up to an event. One dot per
 * no-show is the custom; the cap keeps a slip of the hand from banning a whole event.
 */
export const maxDotsForNotShowingUp = 4

/** A registration whose user did not show up, as the list of them is offered to those giving dots for it. */
export const eventRegistrationNotAttendedSelection = {
    id: true,
    user: {
        select: userBasicSelection,
    },
} satisfies Prisma.EventRegistrationSelect

export enum REGISTRATION_READER_TYPE {
    REGISTRATIONS = 'REGISTRATIONS',
    WAITING_LIST = 'WAITING_LIST',
}

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
