'use server'
import { searchOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const searchAction = makeAction(searchOperations.search)
