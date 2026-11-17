import { adminOrCompanyAdminOrSelf } from '@/services/careers/companies/users/auth'

export const companyUserAuthAuth = {
    sendPasswordLink: adminOrCompanyAdminOrSelf,
    registerNewEmail: adminOrCompanyAdminOrSelf,
} as const
