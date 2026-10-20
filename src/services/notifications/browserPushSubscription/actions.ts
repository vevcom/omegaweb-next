'use server'
import { makeAction } from '@/services/serverAction'
import { browserPushSubscriptionOperations } from '@/services/notifications/browserPushSubscription/operations'

export const createBrowserPushSubscriptionAction = makeAction(browserPushSubscriptionOperations.create)
export const destroyBrowserPushSubscriptionAction = makeAction(browserPushSubscriptionOperations.destroy)
