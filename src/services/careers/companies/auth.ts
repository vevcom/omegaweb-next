import { Require } from '@/auth/authorizer/Require'

export const companyAuth = {
    readSponsors: Require.nothing(),
    create: Require.permission('COMPANY_ADMIN'),
    readPage: Require.permission('COMPANY_USE'),
    update: Require.permission('COMPANY_ADMIN'),
    updateSponsorTier: Require.permission('COMPANY_ADMIN'),
    updateCmsImageLogo: Require.permission('COMPANY_ADMIN'),
    destroy: Require.permission('COMPANY_ADMIN'),
} as const
