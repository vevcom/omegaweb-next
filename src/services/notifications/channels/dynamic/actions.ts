'use server'
import { makeAction } from '@/services/serverAction'
import { dynamicNotificationChannelOperations } from '@/services/notifications/channels/dynamic/operations'

export const createDynamicNotificationChannelAction = makeAction(dynamicNotificationChannelOperations.create)
export const updateDynamicNotificationChannelAction = makeAction(dynamicNotificationChannelOperations.update)
export const destroyDynamicNotificationChannelAction = makeAction(dynamicNotificationChannelOperations.destroy)
export const createNotificationInDynamicChannelAction = makeAction(dynamicNotificationChannelOperations.createNotification)
