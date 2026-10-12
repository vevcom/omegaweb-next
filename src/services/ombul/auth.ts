import { Require } from '@/auth/authorizer/Require'

export const ombulCoversImagePanelAuth = Require.permission('OMBUL_ADMIN')

export const ombulAuth = {
    read: Require.permission('OMBUL_USE'),
    readAll: Require.permission('OMBUL_USE'),
    readLatest: Require.permission('OMBUL_USE'),
    updateCoverImage: Require.permission('OMBUL_ADMIN'),
    destroy: Require.permission('OMBUL_ADMIN'),
    create: Require.permission('OMBUL_ADMIN'),
    update: Require.permission('OMBUL_ADMIN'),
    updateFile: Require.permission('OMBUL_ADMIN'),
    updateParagraphContent: Require.permission('OMBUL_ADMIN'),
} as const
