import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newOmbulNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_OMBUL',
    parent: rootNotificationChannel,
    config: {
        name: 'Ny ombul',
        description: 'Varsling når det kommer ny ombul',
        availableMethods: allNotificationMethodsOn,
    },
})
