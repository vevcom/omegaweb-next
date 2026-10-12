'use server'

import { applicationOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createApplicationAction = makeAction(applicationOperations.create)

export const destroyApplicationAction = makeAction(applicationOperations.destroy)

export const updateApplicationAction = makeAction(applicationOperations.update)
