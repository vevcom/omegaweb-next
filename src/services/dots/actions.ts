'use server'
import { makeAction } from '@/services/serverAction'
import { dotOperations } from '@/services/dots/operations'

export const createDotAction = makeAction(dotOperations.create)
export const updateDotAction = makeAction(dotOperations.update)
export const destroyDotAction = makeAction(dotOperations.destroy)
