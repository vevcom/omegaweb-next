'use server'
import { revueOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const updateMainRevueInfoAction = makeAction(
    revueOperations.mainRevueInfo.update.update
)
export const updateMainRevueInfoAddSectionAction = makeAction(
    revueOperations.mainRevueInfo.update.addSection
)
export const updateMainRevueInfoReorderSectionsAction = makeAction(
    revueOperations.mainRevueInfo.update.reorderSections
)
export const updateMainRevueInfoCoverImageAction = makeAction(
    revueOperations.mainRevueInfo.update.coverImage
)
export const updateMainRevueInfoSectionAction = makeAction(
    revueOperations.mainRevueInfo.update.articleSections.update
)
export const updateMainRevueInfoSectionsAddPartAction = makeAction(
    revueOperations.mainRevueInfo.update.articleSections.addPart
)
export const updateMainRevueInfoSectionsRemovePartAction = makeAction(
    revueOperations.mainRevueInfo.update.articleSections.removePart
)
export const updateMainRevueInfoCmsImageAction = makeAction(
    revueOperations.mainRevueInfo.update.articleSections.cmsImage
)
export const updateMainRevueInfoCmsParagraphAction = makeAction(
    revueOperations.mainRevueInfo.update.articleSections.cmsParagraph
)
export const updateMainRevueInfoCmsLinkAction = makeAction(
    revueOperations.mainRevueInfo.update.articleSections.cmsLink
)
