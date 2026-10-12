import '@pn-server-only'
import { committeeLogosImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { svgExtensions } from '@/services/images/subservice/constants'

export const {
    internalOperations: committeeLogoImageOperations,
    specialCollectionPanelOperations: committeeLogosImagePanelOperations,
    generateCollectionFromConfig: generateCommitteeLogosCollectionFromConfig
} = implementSpecialCollection({
    special: 'COMMITTEELOGOS',
    allowedExtensions: svgExtensions,
    imagePanelAuth: committeeLogosImagePanelAuth,
    config: {
        name: 'Komitélogoer',
        description: 'Bilder brukt som komitélogoer. Hvert bilde i denne samlingen tilhører nøyaktig én komité.',
    }
})
