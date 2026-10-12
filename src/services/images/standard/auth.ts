import { Require } from '@/auth/authorizer/Require'

export const standardImagesImagePanelAuth = Require.nothing()

export const standardImageCollectionAuth = {
    readStandardImage: Require.nothing(),
} as const
