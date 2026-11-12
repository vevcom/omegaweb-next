import { Require } from '@/auth/authorizer/Require'

/** Those who run the companies, or an admin of the company itself. Needs `{ companyId }`. */
const adminOrCompanyAdmin = Require.permission('COMPANY_ADMIN').or().companyAdmin()

/** As above, or any user of the company: colleagues see each other. Needs `{ companyId }`. */
const adminOrCompanyMember = Require.permission('COMPANY_ADMIN').or().companyMember()

/** As `adminOrCompanyAdmin`, or the company user themself. Needs `{ companyId, companyUserId }`. */
const adminOrCompanyAdminOrSelf = Require.permission('COMPANY_ADMIN').or().companyAdmin().or()
    .companyUserId()

export const companyUserAuth = {
    readOfCompany: adminOrCompanyMember,
    read: adminOrCompanyMember,
    create: adminOrCompanyAdmin,
    update: adminOrCompanyAdminOrSelf,
    // Not the user themself: nobody makes themself an admin, or active again.
    updateRole: adminOrCompanyAdmin,
    destroy: adminOrCompanyAdmin,
} as const
