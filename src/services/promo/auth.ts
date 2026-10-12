import { Require } from '@/auth/authorizer/Require'

export const promoImagesImagePanelAuth = Require.permission('FRONTPAGE_ADMIN')

export const promoAuth = {
    create: Require.permission('FRONTPAGE_ADMIN'),
    update: Require.permission('FRONTPAGE_ADMIN'),
    destroy: Require.permission('FRONTPAGE_ADMIN'),
    read: Require.permission('FRONTPAGE_ADMIN'),
    readAll: Require.permission('FRONTPAGE_ADMIN'),
    readActive: Require.nothing(),
    updateImage: Require.permission('FRONTPAGE_ADMIN'),
} as const
