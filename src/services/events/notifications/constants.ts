import type { NotificationMethodGeneral } from '@/services/notifications/types'

/** The info channel is for what the registered must not miss, so it is never held for the weekly mail. */
export const eventInfoChannelMethods: NotificationMethodGeneral = {
    email: true,
    emailWeekly: false,
    push: true,
}

/** The names of an event's three channels, from its name and id, which the names keep when it is renamed. */
export function eventChannelNames(name: string, eventId: number) {
    const own = `${name} (#${eventId})`
    return {
        own,
        info: `${own}: viktig informasjon`,
        general: `${own}: annen informasjon`,
    }
}

export const eventChannelDescriptions = {
    own: 'Varslinger om arrangementet',
    info: 'Det de påmeldte må vite: opprykk fra ventelisten, betaling og viktige endringer i arrangementet',
    general: 'Annet arrangørene har å fortelle om arrangementet',
} as const
