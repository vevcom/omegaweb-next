import { Require } from '@/auth/authorizer/Require'

/**
 * An image collection's admin level decides who may edit, destroy or administrate it (and its
 * images), its regular level who may merely see it. IMAGE_ADMIN bypasses both for every collection.
 * Both still need `{ visibility: DoubleLevelVisibilityMatrix }` supplied via `.data()`.
 */
const regularLevel = Require.permission('IMAGE_ADMIN').or().levelOfDoubleVisibility({ level: 'regularLevel' })
const adminLevel = Require.permission('IMAGE_ADMIN').or().levelOfDoubleVisibility({ level: 'adminLevel' })

export const dynamicImageAuth = {
    readDoubleLevelMatrix: regularLevel,
    updateRegularLevel: adminLevel,
    updateAdminLevel: adminLevel,

    readCollection: regularLevel,
    readCollectionPage: Require.visibilityFilter({ bypassPermission: 'IMAGE_ADMIN' }),

    createCollection: Require.permission('IMAGE_ADMIN').or().permission('IMAGE_CREATE'),
    destroyCollection: adminLevel,
    updateCollection: adminLevel,

    uploadImage: adminLevel,
    uploadManyImages: adminLevel,
    readPageOfImagesInCollection: regularLevel,
    updateImageMeta: adminLevel,
    destroyImage: adminLevel,
} as const
