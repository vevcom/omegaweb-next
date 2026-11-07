'use server'
import { makeAction } from '@/services/serverAction'
import { eventNotificationOperations } from '@/services/events/notifications/operations'

export const createEventNotificationAction = makeAction(eventNotificationOperations.createNotification)
export const createEventPaymentReminderAction = makeAction(eventNotificationOperations.createPaymentReminder)
