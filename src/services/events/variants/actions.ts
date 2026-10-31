'use server'

import { makeAction } from '@/services/serverAction'
import { eventVariantOperations } from '@/services/events/variants/operations'

export const createEventVariantAction = makeAction(eventVariantOperations.create)
export const updateEventVariantAction = makeAction(eventVariantOperations.update)
export const destroyEventVariantAction = makeAction(eventVariantOperations.destroy)
export const reorderEventVariantsAction = makeAction(eventVariantOperations.reorder)
