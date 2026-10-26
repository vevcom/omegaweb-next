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
    'places',
    'waitingList',
    'registrationStart',
    'registrationEnd',
    'canBeViewedBy',
    'takesRegistration',
    'takesPayment',
    'price',
    'paymentStart',
    'paymentEnd'
] as const satisfies (keyof Event)[]

export const eventFilterSelection = {
    ...createSelection(eventFieldsToExpose),
    _count: {
        select: {
            eventRegistrations: true,
        },
    },
} as const

/** What the lists of events select: the exposed fields, the cover image and the tags. */
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
