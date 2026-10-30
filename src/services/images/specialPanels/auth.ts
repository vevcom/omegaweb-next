import { flairImagesImagePanelAuth } from '@/services/flairs/auth'
import { ombulCoversImagePanelAuth } from '@/services/ombul/auth'
import { committeeLogosImagePanelAuth } from '@/services/groups/committees/auth'
import { profileImagesImagePanelAuth } from '@/services/users/auth'
import { standardImagesImagePanelAuth } from '@/services/images/standard/auth'
import { promoImagesImagePanelAuth } from '@/services/promo/auth'
import { cmsPersonImagesImagePanelAuth } from '@/cms/persons/auth'
import type { SpecialCollection } from '@/prisma-generated-pn-types'

/**
 * The panel auth of each special collection, keyed by the collection: whether the session may see
 * its image panel, and administrates the collection when linking an image from it.
 */
export const specialImagePanelAuth = {
    FLAIRIMAGES: flairImagesImagePanelAuth,
    OMBULCOVERS: ombulCoversImagePanelAuth,
    COMMITTEELOGOS: committeeLogosImagePanelAuth,
    PROFILEIMAGES: profileImagesImagePanelAuth,
    STANDARDIMAGES: standardImagesImagePanelAuth,
    PROMOIMAGES: promoImagesImagePanelAuth,
    PERSONIMAGES: cmsPersonImagesImagePanelAuth,
} as const satisfies Record<SpecialCollection, unknown>
