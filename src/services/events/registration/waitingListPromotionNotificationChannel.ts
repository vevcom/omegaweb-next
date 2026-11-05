import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'

export const waitingListPromotionNotificationChannel = implementSpecialNotificationChannel({
    special: 'EVENT_WAITINGLIST_PROMOTION',
    parent: rootNotificationChannel,
    config: {
        name: 'Opprykk fra venteliste',
        description: 'Varsling ved opprykk fra venteliste',
        availableMethods: {
            email: true,
            emailWeekly: false,
            push: true,
        },
    },
})
