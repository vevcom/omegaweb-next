import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newJobAdNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_JOBAD',
    parent: rootNotificationChannel,
    config: {
        name: 'Ny jobbannonse',
        description: 'Varslinger om nye jobbannonser',
        availableMethods: allNotificationMethodsOn,
    },
})
