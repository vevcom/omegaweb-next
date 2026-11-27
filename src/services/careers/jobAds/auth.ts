import { Require } from '@/auth/authorizer/Require'

const useOrCompanyMember = Require.permission('JOBAD_USE').or().companyMember()

export const jobAdAuth = {
    create: Require.permission('JOBAD_ADMIN'),
    read: useOrCompanyMember,
    readOfCompany: useOrCompanyMember,
    readActive: Require.permission('JOBAD_USE'),
    readInactivePage: Require.permission('JOBAD_USE'),
    search: Require.permission('JOBAD_USE'),
    update: Require.permission('JOBAD_ADMIN'),
    updateArticle: Require.permission('JOBAD_ADMIN'),
    destroy: Require.permission('JOBAD_ADMIN'),
} as const
