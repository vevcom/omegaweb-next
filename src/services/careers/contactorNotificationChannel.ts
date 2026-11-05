import '@pn-server-only'
import { implementSpecialNotificationChannel } from '@/services/notifications/subservice/special/implement'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

export const contactorNotificationChannel = implementSpecialNotificationChannel({
    special: 'CONTACTOR',
    config: {
        name: 'Contactor',
        description: 'Her kommer det diverse informasjon fra Contactor',
        availableMethods: allNotificationMethodsOn,
        alias: 'contactor',
    },
})
