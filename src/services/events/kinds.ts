import type { EventKind, EventTag } from '@/prisma-generated-pn-types'

/** How a tag is shown: what `EventTag` and `SmallEventTag` take, which a kind's tag is shown by too. */
export type EventTagLook = Pick<EventTag, 'name' | 'description' | 'colorR' | 'colorG' | 'colorB'>

type EventKindDefinition = {
    name: string,
    /** Shown among the tags of an event of the kind. An ordinary event is marked by nothing. */
    tag: EventTagLook | null,
}

/** What follows from the kind of an event. It is said here once, and nowhere by a tag. */
export const eventKinds = {
    ORDINARY: {
        name: 'Arrangement',
        tag: null,
    },
    COMPANY_PRESENTATION: {
        name: 'Bedriftspresentasjon',
        tag: { name: 'Bedpres', description: 'Bedriftspresentasjon', colorR: 255, colorG: 0, colorB: 0 },
    },
} as const satisfies Record<EventKind, EventKindDefinition>
