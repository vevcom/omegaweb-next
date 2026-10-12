'use server'
import { newStudentOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const updateNewStudentArticleAction = makeAction(
    newStudentOperations.update.update
)
export const updateNewStudentArticleAddSectionAction = makeAction(
    newStudentOperations.update.addSection
)
export const updateNewStudentArticleReorderSectionsAction = makeAction(
    newStudentOperations.update.reorderSections
)
export const updateNewStudentArticleCoverImageAction = makeAction(
    newStudentOperations.update.coverImage
)
export const updateNewStudentArticleSectionAction = makeAction(
    newStudentOperations.update.articleSections.update
)
export const updateNewStudentArticleSectionsAddPartAction = makeAction(
    newStudentOperations.update.articleSections.addPart
)
export const updateNewStudentArticleSectionsRemovePartAction = makeAction(
    newStudentOperations.update.articleSections.removePart
)
export const updateNewStudentArticleCmsImageAction = makeAction(
    newStudentOperations.update.articleSections.cmsImage
)
export const updateNewStudentArticleCmsParagraphAction = makeAction(
    newStudentOperations.update.articleSections.cmsParagraph
)
export const updateNewStudentArticleCmsLinkAction = makeAction(
    newStudentOperations.update.articleSections.cmsLink
)
