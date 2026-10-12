import '@pn-server-only'
import { flairImagesImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { allowedExtensions } from '@/services/images/subservice/constants'

export const {
    internalOperations: flairImageOperations,
    specialCollectionPanelOperations: flairImagesImagePanelOperations,
    generateCollectionFromConfig: generateFlairImagesCollectionFromConfig
} = implementSpecialCollection({
    special: 'FLAIRIMAGES',
    allowedExtensions,
    imagePanelAuth: flairImagesImagePanelAuth,
    config: {
        name: 'Flairbilder',
        description: 'Bilder brukt av flairs. Hvert bilde i denne samlingen tilhører nøyaktig én flair.',
    }
})
