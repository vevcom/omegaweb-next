'use server'
import { careersFrontpageOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const updateCareersFrontpageSpecialCmsParagraphContentAction = makeAction(
    careersFrontpageOperations.cmsParagraphs.updateContent
)
export const updateCareersFrontpageSpecialCmsImageAction = makeAction(careersFrontpageOperations.cmsImages.update)
export const updateCareersFrontpageSpecialCmsLinkAction = makeAction(careersFrontpageOperations.cmsLinks.update)
