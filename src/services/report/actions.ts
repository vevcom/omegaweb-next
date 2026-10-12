'use server'
import { reportOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const updateReportArticleAction = makeAction(
    reportOperations.update.update
)
export const updateReportArticleAddSectionAction = makeAction(
    reportOperations.update.addSection
)
export const updateReportArticleReorderSectionsAction = makeAction(
    reportOperations.update.reorderSections
)
export const updateReportArticleCoverImageAction = makeAction(
    reportOperations.update.coverImage
)
export const updateReportArticleSectionAction = makeAction(
    reportOperations.update.articleSections.update
)
export const updateReportArticleSectionsAddPartAction = makeAction(
    reportOperations.update.articleSections.addPart
)
export const updateReportArticleSectionsRemovePartAction = makeAction(
    reportOperations.update.articleSections.removePart
)
export const updateReportArticleCmsImageAction = makeAction(
    reportOperations.update.articleSections.cmsImage
)
export const updateReportArticleCmsParagraphAction = makeAction(
    reportOperations.update.articleSections.cmsParagraph
)
export const updateReportArticleCmsLinkAction = makeAction(
    reportOperations.update.articleSections.cmsLink
)
