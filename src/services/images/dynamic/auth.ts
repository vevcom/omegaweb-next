import { Require } from '@/auth/authorizer/Require'
import { doubleLevelVisibilityFilter } from '@/auth/visibility/visibilityFilter'
import type { DoubleLevelVisibilityFilter } from '@/auth/visibility/visibilityFilter'

/**
 * An image collection's admin level decides who may edit, destroy or administrate it (and its
 * images), its regular level who may merely see it. IMAGE_ADMIN bypasses both for every collection.
 * Both still need `{ visibility: DoubleLevelVisibilityMatrix }` supplied via `.data()`.
 */
const regularLevel = Require.permission('IMAGE_ADMIN').or().levelOfDoubleVisibility({ level: 'REGULAR' })
const adminLevel = Require.permission('IMAGE_ADMIN').or().levelOfDoubleVisibility({ level: 'ADMIN' })

export const dynamicImageAuth = {
    readDoubleLevelMatrix: regularLevel,
    updateRegularLevel: adminLevel,
    updateAdminLevel: adminLevel,

    readCollection: regularLevel,
    readCollectionPage: Require.permission('IMAGE_ADMIN').or()
        .filter<DoubleLevelVisibilityFilter, { onlyAdministrated: boolean }>(({ session, onlyAdministrated }) =>
            doubleLevelVisibilityFilter(session.memberships, onlyAdministrated ? 'ADMIN' : 'REGULAR')),

    createCollection: Require.permission('IMAGE_ADMIN').or().permission('IMAGE_CREATE'),
    destroyCollection: adminLevel,
    updateCollection: adminLevel,

    uploadImage: adminLevel,
    uploadManyImages: adminLevel,
    readPageOfImagesInCollection: regularLevel,
    updateImageMeta: adminLevel,
    destroyImage: adminLevel,
} as const
