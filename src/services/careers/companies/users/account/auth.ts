import { Require } from '@/auth/authorizer/Require'

/**
 * Those who run the companies, an admin of the company, or the company user themself. Needs
 * `{ companyId, companyUserId }`.
 */
const adminOrCompanyAdminOrSelf = Require.permission('COMPANY_ADMIN').or().companyAdmin().or()
    .companyUserId()

export const companyUserAccountAuth = {
    sendPasswordLink: adminOrCompanyAdminOrSelf,
    registerNewEmail: adminOrCompanyAdminOrSelf,
} as const
