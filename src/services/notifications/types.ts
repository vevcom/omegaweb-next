import type { availableNotificationMethodIncluder } from './channel/constants'
import type { notificationMethodsArray, notificationMethodTypes } from './constants'
import type { Notification, NotificationMethod, Prisma } from '@/prisma-generated-pn-types'

export type NotificationMethodTypes = typeof notificationMethodTypes[number]

export type NotificationMethods = typeof notificationMethodsArray[number]

export type NotificationMethodGeneral = Omit<NotificationMethod, 'id'>

export type ExpandedNotificationChannel = Prisma.NotificationChannelGetPayload<{
    include: typeof availableNotificationMethodIncluder
}>

export type NotificationResult = {
    notification: Notification | null,
}
