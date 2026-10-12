import { Require } from '@/auth/authorizer/Require'
import { requireReadGroupMembers, requireReadMembershipsOfUser } from '@/services/groups/auth'

export const classAuth = {
    read: Require.permission('CLASS_USE'),
    readMany: Require.permission('CLASS_USE'),
    readExpanded: Require.permission('CLASS_USE'),
    readMembers: requireReadGroupMembers('CLASS_USE'),
    readMembershipsOfUser: requireReadMembershipsOfUser('CLASS_USE'),
    readClassOfUser: Require.permission('CLASS_USE'),
    changeClassOfUser: Require.permission('CLASS_ADMIN'),
    bumpClasses: Require.permission('CLASS_ADMIN'),
    migrateGroups: Require.permission('CLASS_ADMIN'),
} as const
