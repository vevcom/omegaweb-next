'use server'
import { revueGroupOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createRevueGroupAction = makeAction(revueGroupOperations.create)
export const updateRevueGroupAction = makeAction(revueGroupOperations.update)
export const destroyRevueGroupAction = makeAction(revueGroupOperations.destroy)

export const updateRevueGroupArticleSectionAction = makeAction(revueGroupOperations.updateArticleSection.update)
export const addPartToRevueGroupArticleSectionAction = makeAction(revueGroupOperations.updateArticleSection.addPart)
export const removePartFromRevueGroupArticleSectionAction = makeAction(
    revueGroupOperations.updateArticleSection.removePart
)
export const updateRevueGroupCmsImageAction = makeAction(revueGroupOperations.updateArticleSection.cmsImage)
export const updateRevueGroupCmsParagraphAction = makeAction(revueGroupOperations.updateArticleSection.cmsParagraph)
export const updateRevueGroupCmsLinkAction = makeAction(revueGroupOperations.updateArticleSection.cmsLink)
