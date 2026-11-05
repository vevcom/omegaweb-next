'use server'
import { searchOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const searchAllAction = makeAction(searchOperations.searchAll)
