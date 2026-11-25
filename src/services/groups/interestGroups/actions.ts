'use server'

import { makeAction } from '@/services/serverAction'
import { interestGroupOperations } from '@/services/groups/interestGroups/operations'

export const createInterestGroupAction = makeAction(interestGroupOperations.create)
export const destroyInterestGroupAction = makeAction(interestGroupOperations.destroy)
export const addInterestGroupMembersAction = makeAction(interestGroupOperations.addMembers)
export const removeInterestGroupMembersAction = makeAction(interestGroupOperations.removeMembers)
export const setInterestGroupMemberAdminAction = makeAction(interestGroupOperations.setMemberAdmin)
export const setInterestGroupMemberTitleAction = makeAction(interestGroupOperations.setMemberTitle)
export const destroyInterestGroupMembershipAction = makeAction(interestGroupOperations.destroyMembership)
export const migrateInterestGroupAction = makeAction(interestGroupOperations.migrateGroup)
export const pensionInterestGroupAction = makeAction(interestGroupOperations.pension)
export const updateInterestGroupAction = makeAction(interestGroupOperations.update)

export const updateSpecialCmsParagraphContentGeneralInfoAction = makeAction(
    interestGroupOperations.generalInfo.updateContent
)

export const updateInterestGroupArticleSectionAction = makeAction(
    interestGroupOperations.articleSection.update
)
export const addPartToInterestGroupArticleSectionAction = makeAction(
    interestGroupOperations.articleSection.addPart
)
export const removePartFromInterestGroupArticleSectionAction = makeAction(
    interestGroupOperations.articleSection.removePart
)
export const updateInterestGroupCmsImageAction = makeAction(
    interestGroupOperations.articleSection.cmsImage
)
export const updateInterestGroupCmsParagraphAction = makeAction(
    interestGroupOperations.articleSection.cmsParagraph
)
export const updateInterestGroupCmsLinkAction = makeAction(
    interestGroupOperations.articleSection.cmsLink
)
