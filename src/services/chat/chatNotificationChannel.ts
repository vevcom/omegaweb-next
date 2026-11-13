import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

/** The channel every chat space's channels sit under. Nothing is sent in it directly. */
export const chatNotificationChannel = implementSpecialNotificationChannel({
    special: 'CHAT',
    parent: rootNotificationChannel,
    config: {
        name: 'Chat',
        description: 'Meldinger i chatområdene du er med i',
        availableMethods: allNotificationMethodsOn,
    },
})
