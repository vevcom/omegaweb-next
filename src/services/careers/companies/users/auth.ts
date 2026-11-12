import { Require } from '@/auth/authorizer/Require'

const companyAdmin = Require.permission('COMPANY_ADMIN')

export const companyUserAuth = {
    readOfCompany: companyAdmin,
    read: companyAdmin,
    create: companyAdmin,
    update: companyAdmin,
    updateRole: companyAdmin,
    destroy: companyAdmin,
} as const
