'use server'

import { screenPageOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createScreenPageAction = makeAction(screenPageOperations.create)
export const updateScreenPageAction = makeAction(screenPageOperations.update)
export const updateScreenPageCmsImageAction = makeAction(screenPageOperations.updateCmsImage)
export const updateScreenPageCmsParagraphContentAction = makeAction(screenPageOperations.updateCmsParagraphContent)
export const destroyScreenPageAction = makeAction(screenPageOperations.destroy)
