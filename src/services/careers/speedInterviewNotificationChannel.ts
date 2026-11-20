import '@ow-server-only'
import { contactorNotificationChannel } from './contactorNotificationChannel'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

/** The channel the own channels of the speed interviews sit under. Nothing is sent in it directly. */
export const speedInterviewNotificationChannel = implementSpecialNotificationChannel({
    special: 'SPEED_INTERVIEW',
    parent: contactorNotificationChannel,
    config: {
        name: 'Speedintervjuer',
        description: 'Nye speedintervjuer, og det som skjer med dem du er meldt på',
        availableMethods: allNotificationMethodsOn,
    },
})
