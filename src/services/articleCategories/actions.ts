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
    articleCategoryOperations.updateArticle.update
)
export const updateArticleCategoryArticleAddSectionAction = makeAction(
    articleCategoryOperations.updateArticle.addSection
)
export const updateArticleCategoryArticleReorderSectionsAction = makeAction(
    articleCategoryOperations.updateArticle.reorderSections
)
export const updateArticleCategoryArticleCoverImageAction = makeAction(
    articleCategoryOperations.updateArticle.coverImage
)
export const updateArticleCategoryArticleSectionAction = makeAction(
    articleCategoryOperations.updateArticle.articleSections.update
)
export const updateArticleCategoryArticleSectionsAddPartAction = makeAction(
    articleCategoryOperations.updateArticle.articleSections.addPart
)
export const updateArticleCategoryArticleSectionsRemovePartAction = makeAction(
    articleCategoryOperations.updateArticle.articleSections.removePart
)
export const updateArticleCategoryArticleCmsImageAction = makeAction(
    articleCategoryOperations.updateArticle.articleSections.cmsImage
)
export const updateArticleCategoryArticleCmsParagraphAction = makeAction(
    articleCategoryOperations.updateArticle.articleSections.cmsParagraph
)
export const updateArticleCategoryArticleCmsLinkAction = makeAction(
    articleCategoryOperations.updateArticle.articleSections.cmsLink
)
