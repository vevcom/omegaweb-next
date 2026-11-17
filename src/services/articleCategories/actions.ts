'use server'
import { articleCategoryOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createArticleCategoryAction = makeAction(articleCategoryOperations.create)
export const destroyArticleCategoryAction = makeAction(articleCategoryOperations.destroy)
export const updateArticleCategoryAction = makeAction(articleCategoryOperations.update)
export const addArticleToCategoryAction = makeAction(articleCategoryOperations.addArticleToCategory)
export const removeArticleFromCategoryAction = makeAction(articleCategoryOperations.removeArticleFromCategory)

export const updateArticleCategoryRegularLevelVisibilityAction = makeAction(
    articleCategoryOperations.visibility.updateRegularLevel
)
export const updateArticleCategoryAdminLevelVisibilityAction = makeAction(
    articleCategoryOperations.visibility.updateAdminLevel
)

export const updateArticleCategoryArticleAction = makeAction(
    articleCategoryOperations.article.update
)
export const updateArticleCategoryArticleAddSectionAction = makeAction(
    articleCategoryOperations.article.addSection
)
export const updateArticleCategoryArticleReorderSectionsAction = makeAction(
    articleCategoryOperations.article.reorderSections
)
export const updateArticleCategoryArticleCoverImageAction = makeAction(
    articleCategoryOperations.article.coverImage
)
export const updateArticleCategoryArticleSectionAction = makeAction(
    articleCategoryOperations.article.articleSections.update
)
export const updateArticleCategoryArticleSectionsAddPartAction = makeAction(
    articleCategoryOperations.article.articleSections.addPart
)
export const updateArticleCategoryArticleSectionsRemovePartAction = makeAction(
    articleCategoryOperations.article.articleSections.removePart
)
export const updateArticleCategoryArticleCmsImageAction = makeAction(
    articleCategoryOperations.article.articleSections.cmsImage
)
export const updateArticleCategoryArticleCmsParagraphAction = makeAction(
    articleCategoryOperations.article.articleSections.cmsParagraph
)
export const updateArticleCategoryArticleCmsLinkAction = makeAction(
    articleCategoryOperations.article.articleSections.cmsLink
)
