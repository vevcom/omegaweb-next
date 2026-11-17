'use server'
import { frontpageOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const updateSpecialCmsParagraphFrontpageSectionAction = makeAction(frontpageOperations.cmsParagraphs.updateContent)
export const updateSpecialCmsImageFrontpageAction = makeAction(frontpageOperations.cmsImages.update)
export const updateSpecialCmsLinkFrontpageAction = makeAction(frontpageOperations.cmsLinks.update)
