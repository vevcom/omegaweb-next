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
    'allowRegistrationInMultipleVariants',
    'canBeViewedBy',
] as const satisfies (keyof Event)[]

/** A quota as the lists and the event page show it, with how many hold one of its places. */
export const eventQuotaSummarySelection = {
    id: true,
    name: true,
    order: true,
    places: true,
    visibilityId: true,
    _count: {
        select: {
            registrations: true,
        },
    },
} as const satisfies Prisma.EventQuotaSelect

export const eventQuotaOrder = [
    { order: 'asc' },
    { id: 'asc' },
] satisfies Prisma.EventQuotaOrderByWithRelationInput[]

/** A variant with its quotas in fill order and how many wait for a place in it. */
export const eventVariantSummarySelection = {
    id: true,
    name: true,
    order: true,
    registrationStart: true,
    registrationEnd: true,
    takesPayment: true,
    price: true,
    paymentStart: true,
    paymentEnd: true,
    quotas: {
        select: eventQuotaSummarySelection,
        orderBy: eventQuotaOrder,
    },
    _count: {
        select: {
            waitingListRegistrations: true,
        },
    },
} as const satisfies Prisma.EventVariantSelect

export const eventVariantOrder = [
    { order: 'asc' },
    { id: 'asc' },
] satisfies Prisma.EventVariantOrderByWithRelationInput[]

export const eventFilterSelection = {
    ...createSelection(eventFieldsToExpose),
    variants: {
        select: eventVariantSummarySelection,
        orderBy: eventVariantOrder,
    },
} as const satisfies Prisma.EventSelect

/** What the lists of events select: the exposed fields, the variants, the cover image and the tags. */
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
