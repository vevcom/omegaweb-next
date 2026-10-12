'use server'

import { makeAction } from '@/services/serverAction'
import { eventTagOperations } from '@/services/events/tags/operations'

export const createEventTagAction = makeAction(eventTagOperations.create)

export const destroyEventTagAction = makeAction(eventTagOperations.destroy)

export const updateEventTagAction = makeAction(eventTagOperations.update)
