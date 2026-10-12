import { Require } from '@/auth/authorizer/Require'
import { requireReadManagedGroupMembers, requireReadMembershipsOfUser } from '@/services/groups/auth'

const adminOrGroupAdmin = Require.permission('STUDY_PROGRAMME_ADMIN').or().groupAdmin()

export const studyProgrammeAuth = {
    create: Require.permission('STUDY_PROGRAMME_ADMIN'),
    upsertMany: Require.permission('STUDY_PROGRAMME_ADMIN'),
    readFeideReturnedForUser: Require.permission('STUDY_PROGRAMME_ADMIN'),
    recordFeideReturnedForUser: Require.permission('STUDY_PROGRAMME_ADMIN'),
    read: Require.permission('STUDY_PROGRAMME_USE'),
    readMany: Require.permission('STUDY_PROGRAMME_USE'),
    readExpanded: Require.permission('STUDY_PROGRAMME_USE'),
    readMembers: requireReadManagedGroupMembers('STUDY_PROGRAMME_USE'),
    readMembershipsOfUser: requireReadMembershipsOfUser('STUDY_PROGRAMME_USE'),
    update: Require.permission('STUDY_PROGRAMME_ADMIN'),
    addMembers: adminOrGroupAdmin,
    removeMembers: adminOrGroupAdmin,
    setMemberAdmin: adminOrGroupAdmin,
    setMemberTitle: adminOrGroupAdmin,
    destroy: Require.permission('STUDY_PROGRAMME_ADMIN'),
    migrateGroups: Require.permission('STUDY_PROGRAMME_ADMIN'),
} as const
