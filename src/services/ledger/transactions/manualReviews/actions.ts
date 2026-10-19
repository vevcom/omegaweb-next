'use server'

import { manualReviewOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const resolveManualReviewAction = makeAction(manualReviewOperations.resolve)
