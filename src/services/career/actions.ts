'use server'
import { careerOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readSpecialCmsParagraphCareerInfoAction = makeAction(
    careerOperations.readSpecialCmsParagraphCareerInfo
)
export const updateSpecialCmsParagraphContentCareerInfoAction = makeAction(
    careerOperations.updateSpecialCmsParagraphContentCareerInfo
)

export const updateCareerSpecialCmsLinkAction = makeAction(
    careerOperations.updateSpecialCmsLink
)
