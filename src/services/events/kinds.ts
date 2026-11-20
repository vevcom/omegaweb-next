import type { EventKind, SpecialNotificationChannel } from '@/prisma-generated-pn-types'

type EventKindDefinition = {
    /** What a visitor is told the event is. */
    name: string,
    /** The special channel the own channels of the events of the kind sit under. */
    notificationChannel: SpecialNotificationChannel,
}

/** What follows from the kind of an event. It is said here once, and nowhere by a tag. */
export const eventKinds = {
    ORDINARY: {
        name: 'Arrangement',
        notificationChannel: 'EVENT',
    },
    COMPANY_PRESENTATION: {
        name: 'Bedriftspresentasjon',
        notificationChannel: 'COMPANY_PRESENTATION',
    },
    SPEED_INTERVIEW: {
        name: 'Speedintervju',
        notificationChannel: 'SPEED_INTERVIEW',
    },
} as const satisfies Record<EventKind, EventKindDefinition>
