import { Require } from '@/auth/authorizer/Require'

export const companyUserAccountAuth = {
    /**
     * Those who run the companies, an admin of the company, or the company user themself. Needs
     * `{ companyId, companyUserId }`.
     */
    sendPasswordLink: Require.permission('COMPANY_ADMIN').or().companyAdmin().or()
        .companyUserId(),
} as const
