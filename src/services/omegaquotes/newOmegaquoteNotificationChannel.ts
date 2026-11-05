import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/subservice/special/implement'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newOmegaquoteNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_OMEGAQUOTE',
    config: {
        name: 'Ny Omegaquote',
        description: 'Varslinger om nye Omegaquotes',
        availableMethods: allNotificationMethodsOn,
    },
})
