'use server'
import { revueOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createRevueAction = makeAction(revueOperations.create)
export const updateRevueAction = makeAction(revueOperations.update)
export const destroyRevueAction = makeAction(revueOperations.destroy)

export const updateRevueArticleAction = makeAction(revueOperations.updateArticle.update)
export const updateRevueArticleAddSectionAction = makeAction(revueOperations.updateArticle.addSection)
export const updateRevueArticleReorderSectionsAction = makeAction(revueOperations.updateArticle.reorderSections)
export const updateRevueArticleCoverImageAction = makeAction(revueOperations.updateArticle.coverImage)
export const updateRevueArticleSectionAction = makeAction(revueOperations.updateArticle.articleSections.update)
export const updateRevueArticleSectionsAddPartAction = makeAction(revueOperations.updateArticle.articleSections.addPart)
export const updateRevueArticleSectionsRemovePartAction = makeAction(
    revueOperations.updateArticle.articleSections.removePart
)
export const updateRevueArticleCmsImageAction = makeAction(revueOperations.updateArticle.articleSections.cmsImage)
export const updateRevueArticleCmsParagraphAction = makeAction(revueOperations.updateArticle.articleSections.cmsParagraph)
export const updateRevueArticleCmsLinkAction = makeAction(revueOperations.updateArticle.articleSections.cmsLink)
