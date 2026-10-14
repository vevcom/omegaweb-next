import { dynamicImageAuth } from '@/services/images/dynamic/auth'
import { specialImagePanels } from '@/services/images/specialPanels/constants'
import type { Authorizer, UserRequiredOutOpt } from '@/auth/authorizer/Authorizer'
import type { SpecialCollection } from '@/prisma-generated-pn-types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

export const cmsImageAuth = {
    /**
     * Linking an image into a cms image, which the service implementing the cms image does not
     * cover: the session must administrate the collection the image is in. A dynamic collection
     * is administrated by its admin level (or IMAGE_ADMIN, as everywhere), a special one by
     * whoever passes the panel auth of the service owning it.
     */
    linkImage: (collection: {
        special: SpecialCollection | null,
        visibility: DoubleLevelVisibilityMatrix,
    }): Authorizer<UserRequiredOutOpt, object | undefined> => (
        collection.special
            ? specialImagePanels[collection.special].auth
            : dynamicImageAuth.updateCollection.data({ visibility: collection.visibility })
    ),
} as const
