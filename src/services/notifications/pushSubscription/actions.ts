'use server'
import { makeAction } from '@/services/serverAction'
import { pushSubscriptionOperations } from '@/services/notifications/pushSubscription/operations'

export const createPushSubscriptionAction = makeAction(pushSubscriptionOperations.create)
export const destroyPushSubscriptionAction = makeAction(pushSubscriptionOperations.destroy)
