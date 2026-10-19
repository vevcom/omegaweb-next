import { specialImagePanelAuth } from '@/services/images/specialPanels/auth'
import {
    readFlairImagesCollectionAction,
    readImagesPageInFlairImagesCollectionAction,
    readOmbulCoversCollectionAction,
    readImagesPageInOmbulCoversCollectionAction,
    readCommitteeLogosCollectionAction,
    readImagesPageInCommitteeLogosCollectionAction,
    readProfileImagesCollectionAction,
    readImagesPageInProfileImagesCollectionAction,
    readStandardImagesCollectionAction,
    readImagesPageInStandardImagesCollectionAction,
    readPromoImagesCollectionAction,
    readImagesPageInPromoImagesCollectionAction,
} from '@/services/images/specialPanels/actions'
import type { ActionFromServiceOperation } from '@/services/actionTypes'
import type { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import type { SpecialCollection } from '@/prisma-generated-pn-types'

type SpecialCollectionPanelOperations = ReturnType<typeof implementSpecialCollection>['specialCollectionPanelOperations']

/**
 * Everything a frontend panel needs for a special collection, keyed by the `SpecialCollection` it
 * shows: the auth deciding whether the session may see the panel, and the actions for reading the
 * collection itself and paging through the images inside it.
 */
export const specialImagePanels = {
    FLAIRIMAGES: {
        auth: specialImagePanelAuth.FLAIRIMAGES,
        readCollectionAction: readFlairImagesCollectionAction,
        readPageOfImagesInCollectionAction: readImagesPageInFlairImagesCollectionAction,
    },
    OMBULCOVERS: {
        auth: specialImagePanelAuth.OMBULCOVERS,
        readCollectionAction: readOmbulCoversCollectionAction,
        readPageOfImagesInCollectionAction: readImagesPageInOmbulCoversCollectionAction,
    },
    COMMITTEELOGOS: {
        auth: specialImagePanelAuth.COMMITTEELOGOS,
        readCollectionAction: readCommitteeLogosCollectionAction,
        readPageOfImagesInCollectionAction: readImagesPageInCommitteeLogosCollectionAction,
    },
    PROFILEIMAGES: {
        auth: specialImagePanelAuth.PROFILEIMAGES,
        readCollectionAction: readProfileImagesCollectionAction,
        readPageOfImagesInCollectionAction: readImagesPageInProfileImagesCollectionAction,
    },
    STANDARDIMAGES: {
        auth: specialImagePanelAuth.STANDARDIMAGES,
        readCollectionAction: readStandardImagesCollectionAction,
        readPageOfImagesInCollectionAction: readImagesPageInStandardImagesCollectionAction,
    },
    PROMOIMAGES: {
        auth: specialImagePanelAuth.PROMOIMAGES,
        readCollectionAction: readPromoImagesCollectionAction,
        readPageOfImagesInCollectionAction: readImagesPageInPromoImagesCollectionAction,
    },
} as const satisfies Record<SpecialCollection, {
    auth: typeof specialImagePanelAuth[SpecialCollection],
    readCollectionAction: ActionFromServiceOperation<SpecialCollectionPanelOperations['readCollection']>,
    readPageOfImagesInCollectionAction:
        ActionFromServiceOperation<SpecialCollectionPanelOperations['readPageOfImagesInCollection']>,
}>
