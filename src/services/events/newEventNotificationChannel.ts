import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/subservice/special/implement'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newEventNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_EVENT',
    config: {
        name: 'Nytt arrangement',
        description: 'Varslinger om nye arrangementer',
        availableMethods: allNotificationMethodsOn,
    },
})
