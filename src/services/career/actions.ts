'use server'
import { careerOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readCareerSpecialCmsParagraphAction = makeAction(careerOperations.readSpecialCmsParagraph)
export const updateCareerSpecialCmsParagraphContentAction = makeAction(
    careerOperations.updateSpecialCmsParagraphContent
)
export const readCareerSpecialCmsImageAction = makeAction(careerOperations.readSpecialCmsImage)
export const updateCareerSpecialCmsImageAction = makeAction(careerOperations.updateSpecialCmsImage)
