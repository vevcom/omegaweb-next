'use server'
import { makeAction } from '@/services/serverAction'
import { jobAdOperations } from '@/services/careers/jobAds/operations'

export const createJobAdAction = makeAction(jobAdOperations.create)
export const destroyJobAdAction = makeAction(jobAdOperations.destroy)
export const readInactiveJobAdsPageAction = makeAction(jobAdOperations.readInactivePage)
export const updateJobAdAction = makeAction(jobAdOperations.update)

export const updateJobAdArticleAction = makeAction(
    jobAdOperations.article.update
)
export const updateJobAdArticleAddSectionAction = makeAction(
    jobAdOperations.article.addSection
)
export const updateJobAdArticleReorderSectionsAction = makeAction(
    jobAdOperations.article.reorderSections
)
export const updateJobAdArticleCoverImageAction = makeAction(
    jobAdOperations.article.coverImage
)
export const updateJobAdArticleSectionAction = makeAction(
    jobAdOperations.article.articleSections.update
)
export const updateJobAdArticleSectionsAddPartAction = makeAction(
    jobAdOperations.article.articleSections.addPart
)
export const updateJobAdArticleSectionsRemovePartAction = makeAction(
    jobAdOperations.article.articleSections.removePart
)
export const updateJobAdArticleCmsImageAction = makeAction(
    jobAdOperations.article.articleSections.cmsImage
)
export const updateJobAdArticleCmsParagraphAction = makeAction(
    jobAdOperations.article.articleSections.cmsParagraph
)
export const updateJobAdArticleCmsLinkAction = makeAction(
    jobAdOperations.article.articleSections.cmsLink
)
