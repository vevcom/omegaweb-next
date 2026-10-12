'use server'
import { ombulOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createOmbulAction = makeAction(ombulOperations.create)
export const destroyOmbulAction = makeAction(ombulOperations.destroy)
export const updateOmbulCoverImageAction = makeAction(ombulOperations.updateCoverImage)
export const updateOmbulAction = makeAction(ombulOperations.update)
export const updateOmbulFileAction = makeAction(ombulOperations.updateFile)
export const updateOmbulParagraphContentAction = makeAction(ombulOperations.updateParagraphContent)
