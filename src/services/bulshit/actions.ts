'use server'
import { bulshitOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createBulshitAction = makeAction(bulshitOperations.create)
export const readBulshitPageAction = makeAction(bulshitOperations.readPage)
