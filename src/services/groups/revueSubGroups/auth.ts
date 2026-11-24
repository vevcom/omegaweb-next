import { Require } from '@/auth/authorizer/Require'
import { requireReadManagedGroupMembers, requireReadMembershipsOfUser } from '@/services/groups/auth'

const revueAdminOrGroupAdmin = Require.permission('REVUE_ADMIN').or().groupAdmin()

export const revueSubGroupAuth = {
    readExpanded: Require.nothing(),
    readMembers: requireReadManagedGroupMembers('REVUE_ADMIN'),
    readMembershipsOfUser: requireReadMembershipsOfUser('USERS_USE'),
    readAddableUsers: revueAdminOrGroupAdmin,
    addMembers: revueAdminOrGroupAdmin,
    removeMembers: revueAdminOrGroupAdmin,
    setMemberAdmin: revueAdminOrGroupAdmin,
    setMemberTitle: revueAdminOrGroupAdmin,
    reorderMembers: revueAdminOrGroupAdmin,
    destroyMembership: revueAdminOrGroupAdmin,
    migrateGroup: Require.permission('REVUE_ADMIN'),
    pension: Require.permission('REVUE_ADMIN'),
} as const
