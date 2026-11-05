import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

/** The channel every event's own channels sit under. Nothing is sent in it directly. */
export const eventNotificationChannel = implementSpecialNotificationChannel({
    special: 'EVENT',
    parent: rootNotificationChannel,
    config: {
        name: 'Arrangementer',
        description: 'Nye arrangementer, og det som skjer med dem du er meldt på',
        availableMethods: allNotificationMethodsOn,
    },
})
