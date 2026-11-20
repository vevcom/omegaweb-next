import type { EventKind, EventTag, SpecialNotificationChannel } from '@/prisma-generated-pn-types'

/** How a tag is shown: what `EventTag` and `SmallEventTag` take, which a kind's tag is shown by too. */
export type EventTagLook = Pick<EventTag, 'name' | 'description' | 'colorR' | 'colorG' | 'colorB'>

type EventKindDefinition = {
    name: string,
    /** Shown among the tags of an event of the kind. An ordinary event is marked by nothing. */
    tag: EventTagLook | null,
    /** The special channel the own channels of the events of the kind sit under. */
    notificationChannel: SpecialNotificationChannel,
}

/** What follows from the kind of an event. It is said here once, and nowhere by a tag. */
export const eventKinds = {
    ORDINARY: {
        name: 'Arrangement',
        tag: null,
        notificationChannel: 'EVENT',
    },
    COMPANY_PRESENTATION: {
        name: 'Bedriftspresentasjon',
        tag: { name: 'Bedpres', description: 'Bedriftspresentasjon', colorR: 255, colorG: 0, colorB: 0 },
        notificationChannel: 'COMPANY_PRESENTATION',
    },
    SPEED_INTERVIEW: {
        name: 'Speedintervju',
        tag: { name: 'Speedintervju', description: 'Speedintervju', colorR: 0, colorG: 90, colorB: 200 },
        notificationChannel: 'SPEED_INTERVIEW',
    },
} as const satisfies Record<EventKind, EventKindDefinition>
