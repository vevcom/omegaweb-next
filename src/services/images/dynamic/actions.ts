'use server'
import { makeAction } from '@/services/serverAction'
import { dynamicImageOperations } from '@/services/images/dynamic/operations'

export const updateDynamicImageCollectionRegularLevelVisibilityAction =
    makeAction(dynamicImageOperations.visibility.updateRegularLevel)
export const updateDynamicImageCollectionAdminLevelVisibilityAction =
    makeAction(dynamicImageOperations.visibility.updateAdminLevel)

export const readDynamicImageCollectionsPageAction = makeAction(dynamicImageOperations.readCollectionPage)
export const createDynamicImageCollectionAction = makeAction(dynamicImageOperations.createCollection)
export const destroyDynamicImageCollectionAction = makeAction(dynamicImageOperations.destroyCollection)
export const updateDynamicImageCollectionAction = makeAction(dynamicImageOperations.updateCollection)

export const uploadImageToDynamicCollectionAction = makeAction(dynamicImageOperations.uploadImage)
export const uploadManyImagesToDynamicCollectionAction = makeAction(dynamicImageOperations.uploadManyImages)
export const readImagesPageInDynamicCollectionAction =
    makeAction(dynamicImageOperations.readPageOfImagesInCollection)
