import { Require } from '@/auth/authorizer/Require'
import { requireReadGroupMembers, requireReadMembershipsOfUser } from '@/services/groups/auth'

export const omegaMembershipGroupAuth = {
    read: Require.permission('OMEGA_MEMBERSHIP_GROUP_USE'),
    readMany: Require.permission('OMEGA_MEMBERSHIP_GROUP_USE'),
    readExpanded: Require.permission('OMEGA_MEMBERSHIP_GROUP_USE'),
    readMembers: requireReadGroupMembers('OMEGA_MEMBERSHIP_GROUP_USE'),
    readMembershipsOfUser: requireReadMembershipsOfUser('OMEGA_MEMBERSHIP_GROUP_USE'),
    readUserLevel: Require.permission('OMEGA_MEMBERSHIP_GROUP_USE'),
    inferUserLevel: Require.permission('OMEGA_MEMBERSHIP_GROUP_USE'),
    updateUserLevel: Require.permission('OMEGA_MEMBERSHIP_GROUP_ADMIN'),
    updateUserOrder: Require.permission('OMEGA_MEMBERSHIP_GROUP_ADMIN'),
    migrateGroups: Require.permission('OMEGA_MEMBERSHIP_GROUP_ADMIN'),
} as const
