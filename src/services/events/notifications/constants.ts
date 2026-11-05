import type { NotificationMethodGeneral } from '@/services/notifications/types'

/** The info channel is for what the registered must not miss, so it is never held for the weekly mail. */
export const eventInfoChannelMethods: NotificationMethodGeneral = {
    email: true,
    emailWeekly: false,
    push: true,
}

export const eventChannelDescriptions = {
    own: 'Varslinger om arrangementet',
    info: 'Det de påmeldte må vite: opprykk fra ventelisten, betaling og viktige endringer i arrangementet',
    general: 'Annet arrangørene har å fortelle om arrangementet',
} as const
