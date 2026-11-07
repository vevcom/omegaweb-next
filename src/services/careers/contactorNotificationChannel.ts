import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { rootNotificationChannel } from '@/services/notifications/channels/rootNotificationChannel'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const contactorNotificationChannel = implementSpecialNotificationChannel({
    special: 'CONTACTOR',
    parent: rootNotificationChannel,
    config: {
        name: 'Contactor',
        description: 'Her kommer det diverse informasjon fra Contactor',
        availableMethods: allNotificationMethodsOn,
        alias: 'contactor',
    },
})
