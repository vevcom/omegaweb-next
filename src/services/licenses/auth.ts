import { Require } from '@/auth/authorizer/Require'

export const licenseAuth = {
    create: Require.permission('LICENSE_ADMIN'),
    // The name and link of a license are shown with every image that has it, and every image upload form
    // lists the licenses to choose from - so reading them cannot be reserved for license admins.
    readAll: Require.nothing(),
    update: Require.permission('LICENSE_ADMIN'),
    destroy: Require.permission('LICENSE_ADMIN'),
} as const
