'use server'
import { bullshitOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createBullshitAction = makeAction(bullshitOperations.create)
export const readBullshitPageAction = makeAction(bullshitOperations.readPage)
