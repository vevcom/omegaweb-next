'use server'
import { careersSearchOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const careersSearchAllAction = makeAction(careersSearchOperations.searchAll)
