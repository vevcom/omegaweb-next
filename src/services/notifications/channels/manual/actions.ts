'use server'
import { makeAction } from '@/services/serverAction'
import { manualNotificationChannelOperations } from '@/services/notifications/channels/manual/operations'

export const createManualNotificationChannelAction = makeAction(manualNotificationChannelOperations.create)
export const updateManualNotificationChannelAction = makeAction(manualNotificationChannelOperations.update)
export const destroyManualNotificationChannelAction = makeAction(manualNotificationChannelOperations.destroy)
export const createNotificationInManualChannelAction = makeAction(manualNotificationChannelOperations.createNotification)
