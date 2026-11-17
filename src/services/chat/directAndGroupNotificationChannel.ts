import '@pn-server-only'
import { chatNotificationChannel } from './chatNotificationChannel'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'

/**
 * The channel for the messages written outside every chat space: direct messages and the group
 * rooms users make themselves. There is one for all of them, since the app keeps no such room.
 */
export const chatDirectAndGroupNotificationChannel = implementSpecialNotificationChannel({
    special: 'CHAT_DIRECT_AND_GROUP',
    parent: chatNotificationChannel,
    config: {
        name: 'Direktemeldinger og grupper',
        description: 'Meldinger skrevet til deg, og i gruppene du er med i utenfor chatområdene',
        availableMethods: { email: true, emailWeekly: false, push: true },
    },
})
