import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/subservice/special/implement'

export const waitingListPromotionNotificationChannel = implementSpecialNotificationChannel({
    special: 'EVENT_WAITINGLIST_PROMOTION',
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
