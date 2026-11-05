'use server'
import { makeAction } from '@/services/serverAction'
import { dynamicNotificationOperations } from '@/services/notifications/dynamic/operations'

export const createDynamicNotificationChannelAction = makeAction(dynamicNotificationOperations.createChannel)
export const updateDynamicNotificationChannelAction = makeAction(dynamicNotificationOperations.updateChannel)
export const destroyDynamicNotificationChannelAction = makeAction(dynamicNotificationOperations.destroyChannel)
export const createDynamicNotificationAction = makeAction(dynamicNotificationOperations.createNotification)
