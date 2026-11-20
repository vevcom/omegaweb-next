'use server'

import { specialImagePanelOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readFlairImagesCollectionAction =
    makeAction(specialImagePanelOperations.FLAIRIMAGES.readCollection)
export const readImagesPageInFlairImagesCollectionAction =
    makeAction(specialImagePanelOperations.FLAIRIMAGES.readPageOfImagesInCollection)

export const readOmbulCoversCollectionAction =
    makeAction(specialImagePanelOperations.OMBULCOVERS.readCollection)
export const readImagesPageInOmbulCoversCollectionAction =
    makeAction(specialImagePanelOperations.OMBULCOVERS.readPageOfImagesInCollection)

export const readCommitteeLogosCollectionAction =
    makeAction(specialImagePanelOperations.COMMITTEELOGOS.readCollection)
export const readImagesPageInCommitteeLogosCollectionAction =
    makeAction(specialImagePanelOperations.COMMITTEELOGOS.readPageOfImagesInCollection)

export const readProfileImagesCollectionAction =
    makeAction(specialImagePanelOperations.PROFILEIMAGES.readCollection)
export const readImagesPageInProfileImagesCollectionAction =
    makeAction(specialImagePanelOperations.PROFILEIMAGES.readPageOfImagesInCollection)

export const readStandardImagesCollectionAction =
    makeAction(specialImagePanelOperations.STANDARDIMAGES.readCollection)
export const readImagesPageInStandardImagesCollectionAction =
    makeAction(specialImagePanelOperations.STANDARDIMAGES.readPageOfImagesInCollection)

export const readPromoImagesCollectionAction =
    makeAction(specialImagePanelOperations.PROMOIMAGES.readCollection)
export const readImagesPageInPromoImagesCollectionAction =
    makeAction(specialImagePanelOperations.PROMOIMAGES.readPageOfImagesInCollection)

export const readCareerTeamImagesCollectionAction =
    makeAction(specialImagePanelOperations.CAREERTEAMIMAGES.readCollection)
export const readImagesPageInCareerTeamImagesCollectionAction =
    makeAction(specialImagePanelOperations.CAREERTEAMIMAGES.readPageOfImagesInCollection)

export const readCompanyLogosCollectionAction =
    makeAction(specialImagePanelOperations.COMPANYLOGOS.readCollection)
export const readImagesPageInCompanyLogosCollectionAction =
    makeAction(specialImagePanelOperations.COMPANYLOGOS.readPageOfImagesInCollection)

export const readChatProfileImagesCollectionAction =
    makeAction(specialImagePanelOperations.CHATPROFILEIMAGES.readCollection)
export const readImagesPageInChatProfileImagesCollectionAction =
    makeAction(specialImagePanelOperations.CHATPROFILEIMAGES.readPageOfImagesInCollection)
