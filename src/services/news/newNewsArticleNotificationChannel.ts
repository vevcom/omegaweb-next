import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newNewsArticleNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_NEWS_ARTICLE',
    parent: rootNotificationChannel,
    config: {
        name: 'Ny nyhetsartikkel',
        description: 'Varslinger om nye nyhetsartikler',
        availableMethods: allNotificationMethodsOn,
    },
})
