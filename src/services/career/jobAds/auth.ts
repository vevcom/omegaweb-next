import { Require } from '@/auth/authorizer/Require'

export const jobAdAuth = {
    create: Require.permission('JOBAD_ADMIN'),
    read: Require.permission('JOBAD_USE'),
    readActive: Require.permission('JOBAD_USE'),
    readInactivePage: Require.permission('JOBAD_USE'),
    update: Require.permission('JOBAD_ADMIN'),
    updateArticle: Require.permission('JOBAD_ADMIN'),
    destroy: Require.permission('JOBAD_ADMIN'),
} as const
