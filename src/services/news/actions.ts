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
    newsOperations.article.update
)
export const updateNewsArticleAddSectionAction = makeAction(
    newsOperations.article.addSection
)
export const updateNewsArticleReorderSectionsAction = makeAction(
    newsOperations.article.reorderSections
)
export const updateNewsArticleCoverImageAction = makeAction(
    newsOperations.article.coverImage
)
export const updateNewsArticleSectionAction = makeAction(
    newsOperations.article.articleSections.update
)
export const updateNewsArticleSectionsAddPartAction = makeAction(
    newsOperations.article.articleSections.addPart
)
export const updateNewsArticleSectionsRemovePartAction = makeAction(
    newsOperations.article.articleSections.removePart
)
export const updateNewsArticleCmsImageAction = makeAction(
    newsOperations.article.articleSections.cmsImage
)
export const updateNewsArticleCmsParagraphAction = makeAction(
    newsOperations.article.articleSections.cmsParagraph
)
export const updateNewsArticleCmsLinkAction = makeAction(
    newsOperations.article.articleSections.cmsLink
)
