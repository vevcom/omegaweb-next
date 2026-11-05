import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/subservice/special/implement'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newNewsArticleNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_NEWS_ARTICLE',
    config: {
        name: 'Ny nyhetsartikkel',
        description: 'Varslinger om nye nyhetsartikler',
        availableMethods: allNotificationMethodsOn,
    },
})
