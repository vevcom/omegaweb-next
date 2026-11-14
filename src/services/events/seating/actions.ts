'use server'

import { eventSeatingOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const openEventSeatingWishesAction = makeAction(eventSeatingOperations.openWishes)
export const updateEventSeatingWishesAction = makeAction(eventSeatingOperations.updateWishes)
export const saveEventSeatingPlanAction = makeAction(eventSeatingOperations.savePlan)
export const setEventSeatingPublishedAction = makeAction(eventSeatingOperations.setPublished)
