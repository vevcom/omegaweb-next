import { adminOrCompanyAdmin } from '@/services/careers/companies/auth'
import { Require } from '@/auth/authorizer/Require'

const adminOrCompanyMember = Require.permission('COMPANY_ADMIN').or().companyMember()

export const adminOrCompanyAdminOrSelf = adminOrCompanyAdmin.or().companyUserId()

export const companyUserAuth = {
    readOfCompany: adminOrCompanyMember,
    read: adminOrCompanyMember,
    create: adminOrCompanyAdmin,
    update: adminOrCompanyAdminOrSelf,
    // Not the user themself: nobody makes themself an admin, or active again.
    updateRole: adminOrCompanyAdmin,
    destroy: adminOrCompanyAdmin,
} as const
