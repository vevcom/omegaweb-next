'use server'
import { revueGroupOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createRevueGroupAction = makeAction(revueGroupOperations.create)
export const addRevueGroupToRevueAction = makeAction(revueGroupOperations.addToRevue)
export const removeRevueGroupFromRevueAction = makeAction(revueGroupOperations.removeFromRevue)
export const readRevueGroupMembersAtOrderAction = makeAction(revueGroupOperations.readMembersAtOrder)
export const updateRevueGroupAction = makeAction(revueGroupOperations.update)
export const destroyRevueGroupAction = makeAction(revueGroupOperations.destroy)

export const updateRevueGroupArticleSectionAction = makeAction(revueGroupOperations.articleSection.update)
export const addPartToRevueGroupArticleSectionAction = makeAction(revueGroupOperations.articleSection.addPart)
export const removePartFromRevueGroupArticleSectionAction = makeAction(
    revueGroupOperations.articleSection.removePart
)
export const updateRevueGroupCmsImageAction = makeAction(revueGroupOperations.articleSection.cmsImage)
export const updateRevueGroupCmsParagraphAction = makeAction(revueGroupOperations.articleSection.cmsParagraph)
export const updateRevueGroupCmsLinkAction = makeAction(revueGroupOperations.articleSection.cmsLink)
