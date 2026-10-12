import { Require } from '@/auth/authorizer/Require'

export const schoolAuth = {
    create: Require.permission('SCHOOLS_ADMIN'),
    createStandard: Require.permission('SCHOOLS_ADMIN'),
    destroy: Require.permission('SCHOOLS_ADMIN'),
    read: Require.permission('SCHOOLS_USE'),
    readExpandedPage: Require.permission('SCHOOLS_USE'),
    readStandard: Require.permission('SCHOOLS_USE'),
    readMany: Require.permission('SCHOOLS_USE'),
    update: Require.permission('SCHOOLS_ADMIN'),
    updateCmsParagraphContent: Require.permission('SCHOOLS_ADMIN'),
    updateCmsImage: Require.permission('SCHOOLS_ADMIN'),
    updateCmsLink: Require.permission('SCHOOLS_ADMIN'),
} as const
