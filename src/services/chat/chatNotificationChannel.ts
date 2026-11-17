import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

/** The channel every channel of the chat sits under. Nothing is sent in it directly. */
export const chatNotificationChannel = implementSpecialNotificationChannel({
    special: 'CHAT',
    parent: rootNotificationChannel,
    config: {
        name: 'Chat',
        description: 'Meldinger på chatten',
        availableMethods: allNotificationMethodsOn,
    },
})
