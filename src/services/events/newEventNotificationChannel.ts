import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newEventNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_EVENT',
    parent: rootNotificationChannel,
    config: {
        name: 'Nytt arrangement',
        description: 'Varslinger om nye arrangementer',
        availableMethods: allNotificationMethodsOn,
    },
})
