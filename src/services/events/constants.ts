import { createSelection } from '@/services/createSelection'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { EventCanView } from '@/prisma-generated-pn-types'
import type { Event, Prisma } from '@/prisma-generated-pn-types'

export const eventCanBeViewedBy = {
    ALL: { label: 'Alle' },
    CAN_REGISTER: { label: 'Alle som kan melde seg på' }
} satisfies Record<EventCanView, { label: string }>

export const eventCanBeViewedByOptions = Object.values(EventCanView).map(opt => ({
    value: opt,
    label: eventCanBeViewedBy[opt].label
}))

export const eventFieldsToExpose = [
    'id',
    'name',
    'location',
    'eventStart',
    'eventEnd',
    'waitingList',
    'bindingRegistration',
    'canBeViewedBy',
    'takesPayment',
    'paymentStart',
    'paymentEnd'
] as const satisfies (keyof Event)[]

/** A quota as the lists and the event page show it, with how many hold one of its places. */
export const eventQuotaSummarySelection = {
    id: true,
    name: true,
    order: true,
    places: true,
    price: true,
    registrationStart: true,
    registrationEnd: true,
    _count: {
        select: {
            registrations: true,
        },
    },
} as const satisfies Prisma.EventRegistrationQuotaSelect

export const eventQuotaOrder = [
    { order: 'asc' },
    { id: 'asc' },
] satisfies Prisma.EventRegistrationQuotaOrderByWithRelationInput[]

export const eventFilterSelection = {
    ...createSelection(eventFieldsToExpose),
    quotas: {
        select: eventQuotaSummarySelection,
        orderBy: eventQuotaOrder,
    },
    _count: {
        select: {
            waitingListRegistrations: true,
        },
    },
} as const satisfies Prisma.EventSelect

/** What the lists of events select: the exposed fields, the quotas, the cover image and the tags. */
export const eventListSelection = {
    ...eventFilterSelection,
    coverImage: {
        include: {
            image: { include: expandedImageIncluder }
        }
    },
    eventTagEvents: {
        include: {
            tag: true
        }
    },
} as const satisfies Prisma.EventSelect

export const defaultSearchResultLimit = 5
