import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const newOmegaquoteNotificationChannel = implementSpecialNotificationChannel({
    special: 'NEW_OMEGAQUOTE',
    parent: rootNotificationChannel,
    config: {
        name: 'Ny Omegaquote',
        description: 'Varslinger om nye Omegaquotes',
        availableMethods: allNotificationMethodsOn,
    },
})
