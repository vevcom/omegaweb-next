import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/subservice/special/implement'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newJobAdNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_JOBAD',
    config: {
        name: 'Ny jobbannonse',
        description: 'Varslinger om nye jobbannonser',
        availableMethods: allNotificationMethodsOn,
    },
})
