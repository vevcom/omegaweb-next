'use server'
import { makeAction } from '@/services/serverAction'
import { committeeOperations } from '@/services/groups/committees/operations'
import { committeeChatSpaceOperations } from '@/services/groups/committees/chatSpace'

export const createCommitteeAction = makeAction(committeeOperations.create)
export const updateCommitteeAction = makeAction(committeeOperations.update)
export const reorderCommitteesAction = makeAction(committeeOperations.reorder)
export const addCommitteeMembersAction = makeAction(committeeOperations.addMembers)
export const removeCommitteeMembersAction = makeAction(committeeOperations.removeMembers)
export const setCommitteeMemberAdminAction = makeAction(committeeOperations.setMemberAdmin)
export const setCommitteeMemberTitleAction = makeAction(committeeOperations.setMemberTitle)
export const reorderCommitteeMembersAction = makeAction(committeeOperations.reorderMembers)
export const destroyCommitteeMembershipAction = makeAction(committeeOperations.destroyMembership)
export const migrateCommitteeAction = makeAction(committeeOperations.migrateGroup)
export const pensionCommitteeAction = makeAction(committeeOperations.pension)
export const updateCommitteeParagraphAction = makeAction(committeeOperations.updateParagraphContent)

export const updateCommitteeLogoAction = makeAction(committeeOperations.updateLogo)

export const updateCommitteeArticleAction = makeAction(
    committeeOperations.article.update
)
export const updateCommitteeArticleAddSectionAction = makeAction(
    committeeOperations.article.addSection
)
export const updateCommitteeArticleReorderSectionsAction = makeAction(
    committeeOperations.article.reorderSections
)
export const updateCommitteeArticleCoverImageAction = makeAction(
    committeeOperations.article.coverImage
)
export const updateCommitteeArticleSectionAction = makeAction(
    committeeOperations.article.articleSections.update
)
export const updateCommitteeArticleSectionsAddPartAction = makeAction(
    committeeOperations.article.articleSections.addPart
)
export const updateCommitteeArticleSectionsRemovePartAction = makeAction(
    committeeOperations.article.articleSections.removePart
)
export const updateCommitteeArticleCmsImageAction = makeAction(
    committeeOperations.article.articleSections.cmsImage
)
export const updateCommitteeArticleCmsParagraphAction = makeAction(
    committeeOperations.article.articleSections.cmsParagraph
)
export const updateCommitteeArticleCmsLinkAction = makeAction(
    committeeOperations.article.articleSections.cmsLink
)

export const createCommitteeChatSpaceAction = makeAction(committeeChatSpaceOperations.create)
export const destroyCommitteeChatSpaceAction = makeAction(committeeChatSpaceOperations.destroy)
export const readCommitteeChatSpaceAddableUsersAction = makeAction(committeeChatSpaceOperations.readAddableUsers)
export const addCommitteeChatSpaceMembersAction = makeAction(committeeChatSpaceOperations.addMembers)
export const removeCommitteeChatSpaceMembersAction = makeAction(committeeChatSpaceOperations.removeMembers)
export const createCommitteeChatSpaceRoomAction = makeAction(committeeChatSpaceOperations.createRoom)
export const updateCommitteeChatSpaceRoomAction = makeAction(committeeChatSpaceOperations.updateRoom)
export const destroyCommitteeChatSpaceRoomAction = makeAction(committeeChatSpaceOperations.destroyRoom)
export const addCommitteeChatSpaceRoomMembersAction = makeAction(committeeChatSpaceOperations.addRoomMembers)
export const removeCommitteeChatSpaceRoomMembersAction = makeAction(committeeChatSpaceOperations.removeRoomMembers)
