import '@ow-server-only'
import { contactorNotificationChannel } from './contactorNotificationChannel'
import { implementSpecialNotificationChannel } from '@/services/notifications/channels/implementSpecial'
import { allNotificationMethodsOn } from '@/services/notifications/constants'

/** The channel the own channels of the company presentations sit under. Nothing is sent in it directly. */
export const companyPresentationNotificationChannel = implementSpecialNotificationChannel({
    special: 'COMPANY_PRESENTATION',
    parent: contactorNotificationChannel,
    config: {
        name: 'Bedriftspresentasjoner',
        description: 'Nye bedriftspresentasjoner, og det som skjer med dem du er meldt på',
        availableMethods: allNotificationMethodsOn,
    },
})
