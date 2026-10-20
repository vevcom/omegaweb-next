import { Require } from '@/auth/authorizer/Require'

export const screenPageAuth = {
    create: Require.permission('SCREEN_ADMIN'),
    read: Require.permission('SCREEN_USE'),
    readMany: Require.permission('SCREEN_USE'),
    update: Require.permission('SCREEN_ADMIN'),
    updateCmsImage: Require.permission('SCREEN_ADMIN'),
    updateCmsParagraphContent: Require.permission('SCREEN_ADMIN'),
    destroy: Require.permission('SCREEN_ADMIN'),
} as const
