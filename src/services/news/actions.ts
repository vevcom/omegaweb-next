'use server'
import { newsOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createNewsAction = makeAction(newsOperations.create)
export const destroyNewsAction = makeAction(newsOperations.destroy)
export const readOldNewsPageAction = makeAction(newsOperations.readOldPage)
export const updateNewsAction = makeAction(newsOperations.update)
export const setNewsPublishedAction = makeAction(newsOperations.setPublished)

export const updateNewsRegularLevelVisibilityAction = makeAction(newsOperations.visibility.updateRegularLevel)
export const updateNewsAdminLevelVisibilityAction = makeAction(newsOperations.visibility.updateAdminLevel)

export const updateNewsArticleAction = makeAction(
    newsOperations.updateArticle.update
)
export const updateNewsArticleAddSectionAction = makeAction(
    newsOperations.updateArticle.addSection
)
export const updateNewsArticleReorderSectionsAction = makeAction(
    newsOperations.updateArticle.reorderSections
)
export const updateNewsArticleCoverImageAction = makeAction(
    newsOperations.updateArticle.coverImage
)
export const updateNewsArticleSectionAction = makeAction(
    newsOperations.updateArticle.articleSections.update
)
export const updateNewsArticleSectionsAddPartAction = makeAction(
    newsOperations.updateArticle.articleSections.addPart
)
export const updateNewsArticleSectionsRemovePartAction = makeAction(
    newsOperations.updateArticle.articleSections.removePart
)
export const updateNewsArticleCmsImageAction = makeAction(
    newsOperations.updateArticle.articleSections.cmsImage
)
export const updateNewsArticleCmsParagraphAction = makeAction(
    newsOperations.updateArticle.articleSections.cmsParagraph
)
export const updateNewsArticleCmsLinkAction = makeAction(
    newsOperations.updateArticle.articleSections.cmsLink
)
