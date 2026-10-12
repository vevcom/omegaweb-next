'use server'

import { makeAction } from '@/services/serverAction'
import { classOperations } from '@/services/groups/classes/operations'

export const changeClassOfUserAction = makeAction(classOperations.changeClassOfUser)
export const bumpClassesAction = makeAction(classOperations.bumpClasses)
