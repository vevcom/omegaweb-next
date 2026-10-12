import { Require } from '@/auth/authorizer/Require'
import { requireReadManagedGroupMembers, requireReadMembershipsOfUser } from '@/services/groups/auth'

export const committeeLogosImagePanelAuth = Require.permission('COMMITTEE_ADMIN')

const adminOrGroupAdmin = Require.permission('COMMITTEE_ADMIN').or().groupAdmin()

export const committeeAuth = {
    create: Require.permission('COMMITTEE_ADMIN'),
    update: Require.permission('COMMITTEE_ADMIN'),
    readAll: Require.permission('COMMITTEE_USE'),
    read: Require.permission('COMMITTEE_USE'),
    readMembers: requireReadManagedGroupMembers('COMMITTEE_USE'),
    readMembershipsOfUser: requireReadMembershipsOfUser('COMMITTEE_USE'),
    readExpanded: Require.permission('COMMITTEE_USE'),
    addMembers: adminOrGroupAdmin,
    removeMembers: adminOrGroupAdmin,
    setMemberAdmin: adminOrGroupAdmin,
    setMemberTitle: adminOrGroupAdmin,
    migrateGroup: adminOrGroupAdmin,
    readArticle: Require.permission('COMMITTEE_USE'),
    readParagraph: Require.permission('COMMITTEE_USE'),
    destroy: Require.permission('COMMITTEE_ADMIN'),
    pension: Require.permission('COMMITTEE_ADMIN'),
    updateParagraphContent: adminOrGroupAdmin,
    updateLogo: adminOrGroupAdmin,
    updateArticle: adminOrGroupAdmin,
} as const
