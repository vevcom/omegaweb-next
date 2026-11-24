import { Require } from '@/auth/authorizer/Require'
import { requireReadGroupMembers, requireReadMembershipsOfUser } from '@/services/groups/auth'

const revueAdmin = Require.permission('REVUE_ADMIN')

export const revueGroupAuth = {
    create: revueAdmin,
    addToRevue: revueAdmin,
    removeFromRevue: revueAdmin,
    readMany: revueAdmin,
    read: revueAdmin,
    readToCarryOver: requireReadGroupMembers('REVUE_ADMIN'),
    readManyInRevue: Require.nothing(),
    readInRevue: Require.nothing(),
    update: revueAdmin,
    destroy: revueAdmin,
    updateArticleSection: revueAdmin.or().groupAdmin(),
    readManyOfUser: requireReadMembershipsOfUser('USERS_USE'),
    readMemberProfilesInRevue: Require.permission('USERS_USE'),
} as const
