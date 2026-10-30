import '@pn-server-only'
import { flairImagesImagePanelOperations } from '@/services/flairs/flairImageCollection'
import { ombulCoversImagePanelOperations } from '@/services/ombul/ombulCoverCollection'
import { committeeLogosImagePanelOperations } from '@/services/groups/committees/committeeLogoCollection'
import { profileImagesImagePanelOperations } from '@/services/users/profileImageCollection'
import { standardImagesImagePanelOperations } from '@/services/images/standard/standardImageCollection'
import { promoImagesImagePanelOperations } from '@/services/promo/promoImageCollection'
import { cmsPersonImagesImagePanelOperations } from '@/cms/persons/personImageCollection'

/**
 * This is an assembly of all the `panel operations` - operations needed to display an
 * image panel in the frontend.
 *
 * This allows users (passing panel auth) to look through the images in the special collection.
 * And it allows them to be shown when editing Cms images.
 */
export const specialImagePanelOperations = {
    flairImages: flairImagesImagePanelOperations,
    ombulCovers: ombulCoversImagePanelOperations,
    committeeLogos: committeeLogosImagePanelOperations,
    profileImages: profileImagesImagePanelOperations,
    standardImages: standardImagesImagePanelOperations,
    promoImages: promoImagesImagePanelOperations,
    personImages: cmsPersonImagesImagePanelOperations,
} as const
