import type { NotificationMethodGeneral } from './types'

export const notificationMethodsDisplayMap = {
    email: 'E-post',
    emailWeekly: 'Ukentlig e-post',
    push: 'Push-varsel',
} satisfies Record<keyof NotificationMethodGeneral, string>

export const allNotificationMethodsOn: NotificationMethodGeneral = {
    email: true,
    emailWeekly: true,
    push: true,
}

export const allNotificationMethodsOff: NotificationMethodGeneral = {
    email: false,
    emailWeekly: false,
    push: false,
}

export const notificationMethodTypes = ['availableMethods', 'defaultMethods'] as const
export const notificationMethodsArray = [
    'email',
    'emailWeekly',
    'push',
] as const satisfies (keyof NotificationMethodGeneral)[]
