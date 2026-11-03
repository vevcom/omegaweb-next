'use server'

import { makeAction } from '@/services/serverAction'
import { eventQuotaOperations } from '@/services/events/quotas/operations'

export const createEventQuotaAction = makeAction(eventQuotaOperations.create)
export const updateEventQuotaAction = makeAction(eventQuotaOperations.update)
export const destroyEventQuotaAction = makeAction(eventQuotaOperations.destroy)
export const reorderEventQuotasAction = makeAction(eventQuotaOperations.reorder)
export const updateEventQuotaVisibilityAction = makeAction(eventQuotaOperations.visibility.update)
