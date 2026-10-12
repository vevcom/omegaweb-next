'use server'
import { makeAction } from '@/services/serverAction'
import { jobAdOperations } from '@/services/career/jobAds/operations'

export const createJobAdAction = makeAction(jobAdOperations.create)
export const destroyJobAdAction = makeAction(jobAdOperations.destroy)
export const readInactiveJobAdsPageAction = makeAction(jobAdOperations.readInactivePage)
export const updateJobAdAction = makeAction(jobAdOperations.update)

export const updateJobAdArticleAction = makeAction(
    jobAdOperations.updateArticle.update
)
export const updateJobAdArticleAddSectionAction = makeAction(
    jobAdOperations.updateArticle.addSection
)
export const updateJobAdArticleReorderSectionsAction = makeAction(
    jobAdOperations.updateArticle.reorderSections
)
export const updateJobAdArticleCoverImageAction = makeAction(
    jobAdOperations.updateArticle.coverImage
)
export const updateJobAdArticleSectionAction = makeAction(
    jobAdOperations.updateArticle.articleSections.update
)
export const updateJobAdArticleSectionsAddPartAction = makeAction(
    jobAdOperations.updateArticle.articleSections.addPart
)
export const updateJobAdArticleSectionsRemovePartAction = makeAction(
    jobAdOperations.updateArticle.articleSections.removePart
)
export const updateJobAdArticleCmsImageAction = makeAction(
    jobAdOperations.updateArticle.articleSections.cmsImage
)
export const updateJobAdArticleCmsParagraphAction = makeAction(
    jobAdOperations.updateArticle.articleSections.cmsParagraph
)
export const updateJobAdArticleCmsLinkAction = makeAction(
    jobAdOperations.updateArticle.articleSections.cmsLink
)
