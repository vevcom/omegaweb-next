'use server'
import { careersFrontpageOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readCareersFrontpageSpecialCmsParagraphAction = makeAction(careersFrontpageOperations.readSpecialCmsParagraph)
export const updateCareersFrontpageSpecialCmsParagraphContentAction = makeAction(
    careersFrontpageOperations.updateSpecialCmsParagraphContent
)
export const readCareersFrontpageSpecialCmsImageAction = makeAction(careersFrontpageOperations.readSpecialCmsImage)
export const updateCareersFrontpageSpecialCmsImageAction = makeAction(careersFrontpageOperations.updateSpecialCmsImage)
export const readCareersFrontpageSpecialCmsLinkAction = makeAction(careersFrontpageOperations.readSpecialCmsLink)
export const updateCareersFrontpageSpecialCmsLinkAction = makeAction(careersFrontpageOperations.updateSpecialCmsLink)
