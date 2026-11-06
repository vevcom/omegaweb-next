import '@pn-server-only'
import { implementSpecialNotificationChannel } from './implementSpecial'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

/** The top of the channel tree, which every other channel sits under. */
export const rootNotificationChannel = implementSpecialNotificationChannel({
    special: 'ROOT',
    config: {
        name: 'Alle varslinger',
        description: 'Denne kanalen styrer alle varslinger',
        availableMethods: allNotificationMethodsOn,
    },
})
