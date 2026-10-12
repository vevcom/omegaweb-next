import { Require } from '@/auth/authorizer/Require'
import { requireReadManagedGroupMembers, requireReadMembershipsOfUser } from '@/services/groups/auth'

const groupAdminOrInterestGroupAdmin = Require.permission('INTEREST_GROUP_ADMIN').or().groupAdmin()

export const interestGroupAuth = {
    create: Require.permission('INTEREST_GROUP_ADMIN'),
    read: Require.permission('INTEREST_GROUP_USE'),
    readMany: Require.permission('INTEREST_GROUP_USE'),
    readExpanded: Require.permission('INTEREST_GROUP_USE'),
    readMembers: requireReadManagedGroupMembers('INTEREST_GROUP_USE'),
    readMembershipsOfUser: requireReadMembershipsOfUser('INTEREST_GROUP_USE'),
    addMembers: groupAdminOrInterestGroupAdmin,
    removeMembers: groupAdminOrInterestGroupAdmin,
    setMemberAdmin: groupAdminOrInterestGroupAdmin,
    setMemberTitle: groupAdminOrInterestGroupAdmin,
    migrateGroup: groupAdminOrInterestGroupAdmin,
    update: groupAdminOrInterestGroupAdmin,
    destroy: Require.permission('INTEREST_GROUP_ADMIN'),
    pension: Require.permission('INTEREST_GROUP_ADMIN'),
    readSpecialCmsParagraphGeneralInfo: Require.permission('INTEREST_GROUP_USE'),
    updateSpecialCmsParagraphContentGeneralInfo: Require.permission('INTEREST_GROUP_ADMIN'),
    updateArticleSection: groupAdminOrInterestGroupAdmin,
} as const
