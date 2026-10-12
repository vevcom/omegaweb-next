'use server'
import { makeAction } from '@/services/serverAction'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'

export const createNotificationChannelAction = makeAction(notificationChannelOperations.create)
export const updateNotificationChannelAction = makeAction(notificationChannelOperations.update)
