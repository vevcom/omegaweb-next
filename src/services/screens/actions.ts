'use server'

import { screenOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createScreenAction = makeAction(screenOperations.create)
export const updateScreenAction = makeAction(screenOperations.update)
export const updateScreenPagesAction = makeAction(screenOperations.updatePages)
export const destroyScreenAction = makeAction(screenOperations.destroy)
