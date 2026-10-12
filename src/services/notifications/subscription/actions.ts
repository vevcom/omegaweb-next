'use server'
import { makeAction } from '@/services/serverAction'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'

export const updateNotificationSubscriptionsAction = makeAction(notificationSubscriptionOperations.update)
