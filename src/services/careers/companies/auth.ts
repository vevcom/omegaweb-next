import { Require } from '@/auth/authorizer/Require'

export const companyLogosImagePanelAuth = Require.permission('COMPANY_ADMIN')

/** Those who run the companies, or an admin of the company itself. Needs `{ companyId }`. */
const adminOrCompanyAdmin = Require.permission('COMPANY_ADMIN').or().companyAdmin()

export const companyAuth = {
    readSponsors: Require.nothing(),
    create: Require.permission('COMPANY_ADMIN'),
    read: Require.permission('COMPANY_USE'),
    readPage: Require.permission('COMPANY_USE'),
    search: Require.permission('COMPANY_USE'),
    update: adminOrCompanyAdmin,
    updateSponsorTier: Require.permission('COMPANY_ADMIN'),
    updateLogo: adminOrCompanyAdmin,
    destroy: Require.permission('COMPANY_ADMIN'),
} as const
