import { Require } from '@/auth/authorizer/Require'

export const standardImagesImagePanelAuth = Require.nothing()

export const standardImageCollectionAuth = {
    readStandardImage: Require.nothing(),
    readAllStandardImages: Require.nothing(),
} as const
