import { Require } from '@/auth/authorizer/Require'

export const licenseAuth = {
    create: Require.permission('LICENSE_ADMIN'),
    read: Require.permission('LICENSE_ADMIN'),
    update: Require.permission('LICENSE_ADMIN'),
    destroy: Require.permission('LICENSE_ADMIN'),
} as const
