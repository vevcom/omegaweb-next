import type { EventKind, EventRegistrationType, SpecialNotificationChannel } from '@/prisma-generated-pn-types'

/** A time of day some days before the day an event starts, both in Oslo. */
export type TimeBeforeEventDay = {
    daysBefore: number,
    hour: number,
}

type EventKindDefinition = {
    /** What a visitor is told the event is. */
    name: string,
    /** The special channel the own channels of the events of the kind sit under. */
    notificationChannel: SpecialNotificationChannel,
    /** The kind of the one event an event of the kind may be linked to, as `Event.companyPresentationId`. */
    linksTo: EventKind | null,
    /** What an event of the kind starts with, which its administrators change freely after. */
    firstSetup: {
        bindingRegistration: boolean,
        /** How the first variant hands out its places. */
        registrationType: EventRegistrationType,
        /** Null when the kind gives none, so the event starts with the period any event does. */
        registrationPeriod: { opens: TimeBeforeEventDay, closes: TimeBeforeEventDay } | null,
    },
}

const careerRegistrationPeriod = {
    opens: { daysBefore: 7, hour: 12 },
    closes: { daysBefore: 0, hour: 12 },
} as const

/** What follows from the kind of an event. It is said here once, and nowhere by a tag. */
export const eventKinds = {
    ORDINARY: {
        name: 'Arrangement',
        notificationChannel: 'EVENT',
        linksTo: null,
        firstSetup: {
            bindingRegistration: false,
            registrationType: 'LIST',
            registrationPeriod: null,
        },
    },
    COMPANY_PRESENTATION: {
        name: 'Bedriftspresentasjon',
        notificationChannel: 'COMPANY_PRESENTATION',
        linksTo: null,
        firstSetup: {
            bindingRegistration: true,
            registrationType: 'LIST',
            registrationPeriod: careerRegistrationPeriod,
        },
    },
    SPEED_INTERVIEW: {
        name: 'Speedintervju',
        notificationChannel: 'SPEED_INTERVIEW',
        linksTo: 'COMPANY_PRESENTATION',
        firstSetup: {
            bindingRegistration: true,
            registrationType: 'SLOTTED',
            registrationPeriod: careerRegistrationPeriod,
        },
    },
} as const satisfies Record<EventKind, EventKindDefinition>
