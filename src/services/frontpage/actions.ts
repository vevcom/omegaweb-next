'use server'
import { frontpageOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readSpecialCmsParagraphFrontpageSectionAction = makeAction(
    frontpageOperations.readSpecialCmsParagraphSection
)

export const updateSpecialCmsParagraphFrontpageSectionAction = makeAction(
    frontpageOperations.updateSpecialCmsParagraphContentSection
)

export const readSpecialCmsImageFrontpageAction = makeAction(
    frontpageOperations.readSpecialCmsImage
)

export const updateSpecialCmsImageFrontpageAction = makeAction(
    frontpageOperations.updateSpecialCmsImage
)
