'use server'
import { revueFrontpageOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const updateMainRevueInfoAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.update
)
export const updateMainRevueInfoAddSectionAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.addSection
)
export const updateMainRevueInfoReorderSectionsAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.reorderSections
)
export const updateMainRevueInfoCoverImageAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.coverImage
)
export const updateMainRevueInfoSectionAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.articleSections.update
)
export const updateMainRevueInfoSectionsAddPartAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.articleSections.addPart
)
export const updateMainRevueInfoSectionsRemovePartAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.articleSections.removePart
)
export const updateMainRevueInfoCmsImageAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.articleSections.cmsImage
)
export const updateMainRevueInfoCmsParagraphAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.articleSections.cmsParagraph
)
export const updateMainRevueInfoCmsLinkAction = makeAction(
    revueFrontpageOperations.mainRevueInfo.update.articleSections.cmsLink
)
