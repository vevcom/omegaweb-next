'use server'
import { makeAction } from '@/services/serverAction'
import { notificationOperations } from '@/services/notifications/operations'

export const createNotificationAction = makeAction(notificationOperations.create)
