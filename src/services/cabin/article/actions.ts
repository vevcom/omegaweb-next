'use server'
import { cabinArticleOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const updateCabinArticleAction = makeAction(cabinArticleOperations.update.update)
export const updateCabinArticleAddSectionAction = makeAction(cabinArticleOperations.update.addSection)
export const updateCabinArticleReorderSectionsAction = makeAction(cabinArticleOperations.update.reorderSections)
export const updateCabinArticleCoverImageAction = makeAction(cabinArticleOperations.update.coverImage)
export const updateCabinArticleSectionAction = makeAction(cabinArticleOperations.update.articleSections.update)
export const updateCabinArticleSectionsAddPartAction = makeAction(
    cabinArticleOperations.update.articleSections.addPart
)
export const updateCabinArticleSectionsRemovePartAction = makeAction(
    cabinArticleOperations.update.articleSections.removePart
)
export const updateCabinArticleCmsImageAction = makeAction(cabinArticleOperations.update.articleSections.cmsImage)
export const updateCabinArticleCmsParagraphAction = makeAction(
    cabinArticleOperations.update.articleSections.cmsParagraph
)
export const updateCabinArticleCmsLinkAction = makeAction(cabinArticleOperations.update.articleSections.cmsLink)
