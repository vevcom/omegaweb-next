'use server'
import { schoolOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createSchoolAction = makeAction(schoolOperations.create)
export const destroySchoolAction = makeAction(schoolOperations.destroy)
export const readSchoolAction = makeAction(schoolOperations.read)
export const readExpandedSchoolsPageAction = makeAction(schoolOperations.readExpandedPage)
export const readStandardSchoolsAction = makeAction(schoolOperations.readStandard)
export const readSchoolsAction = makeAction(schoolOperations.readMany)
export const updateSchoolAction = makeAction(schoolOperations.update)

export const updateSchoolCmsParagraphContentAction = makeAction(schoolOperations.updateCmsParagraphContent)
export const updateSchoolCmsImageAction = makeAction(schoolOperations.updateCmsImage)
export const updateSchoolCmsLinkAction = makeAction(schoolOperations.updateCmsLink)
