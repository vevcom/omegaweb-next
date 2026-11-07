'use server'
import { omegawebSearchOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const omegawebSearchAllAction = makeAction(omegawebSearchOperations.searchAll)
