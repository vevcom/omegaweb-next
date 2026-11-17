'use server'
import { revueOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createRevueAction = makeAction(revueOperations.create)
export const updateRevueAction = makeAction(revueOperations.update)
export const destroyRevueAction = makeAction(revueOperations.destroy)

export const updateRevueArticleAction = makeAction(revueOperations.article.update)
export const updateRevueArticleAddSectionAction = makeAction(revueOperations.article.addSection)
export const updateRevueArticleReorderSectionsAction = makeAction(revueOperations.article.reorderSections)
export const updateRevueArticleCoverImageAction = makeAction(revueOperations.article.coverImage)
export const updateRevueArticleSectionAction = makeAction(revueOperations.article.articleSections.update)
export const updateRevueArticleSectionsAddPartAction = makeAction(revueOperations.article.articleSections.addPart)
export const updateRevueArticleSectionsRemovePartAction = makeAction(
    revueOperations.article.articleSections.removePart
)
export const updateRevueArticleCmsImageAction = makeAction(revueOperations.article.articleSections.cmsImage)
export const updateRevueArticleCmsParagraphAction = makeAction(revueOperations.article.articleSections.cmsParagraph)
export const updateRevueArticleCmsLinkAction = makeAction(revueOperations.article.articleSections.cmsLink)
