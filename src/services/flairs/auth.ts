import { Require } from '@/auth/authorizer/Require'

export const flairImagesImagePanelAuth = Require.permission('FLAIR_ADMIN')

export const flairAuth = {
    create: Require.permission('FLAIR_ADMIN'),
    destroy: Require.permission('FLAIR_ADMIN'),
    update: Require.permission('FLAIR_ADMIN'),
    assignToUser: Require.permission('FLAIR_ADMIN'),
    unAssignToUser: Require.permission('FLAIR_ADMIN'),
    increaseRank: Require.permission('FLAIR_ADMIN'),
    decreaseRank: Require.permission('FLAIR_ADMIN'),
    read: Require.nothing(),
    readAll: Require.nothing(),
    readUserFlairs: Require.permission('USERS_USE').or().userId(),
    updateImage: Require.permission('FLAIR_ADMIN'),
} as const
