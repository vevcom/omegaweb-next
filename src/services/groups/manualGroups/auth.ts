import { Require } from '@/auth/authorizer/Require'
import { requireReadManagedGroupMembers, requireReadMembershipsOfUser } from '@/services/groups/auth'

const adminOrGroupAdmin = Require.permission('MANUAL_GROUP_ADMIN').or().groupAdmin()

export const manualGroupAuth = {
    create: Require.permission('MANUAL_GROUP_ADMIN'),
    read: Require.permission('MANUAL_GROUP_USE'),
    readMany: Require.permission('MANUAL_GROUP_USE'),
    readExpanded: Require.permission('MANUAL_GROUP_USE'),
    readMembers: requireReadManagedGroupMembers('MANUAL_GROUP_USE'),
    readMembershipsOfUser: requireReadMembershipsOfUser('MANUAL_GROUP_USE'),
    update: Require.permission('MANUAL_GROUP_ADMIN'),
    destroy: Require.permission('MANUAL_GROUP_ADMIN'),
    pension: Require.permission('MANUAL_GROUP_ADMIN'),
    addMembers: adminOrGroupAdmin,
    removeMembers: adminOrGroupAdmin,
    setMemberAdmin: adminOrGroupAdmin,
    setMemberTitle: adminOrGroupAdmin,
    migrateGroup: adminOrGroupAdmin,
} as const
