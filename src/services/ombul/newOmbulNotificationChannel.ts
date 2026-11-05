import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/subservice/special/implement'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newOmbulNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_OMBUL',
    config: {
        name: 'Ny ombul',
        description: 'Varsling når det kommer ny ombul',
        availableMethods: allNotificationMethodsOn,
    },
})
