import '@pn-server-only'
import { ombulCoversImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { rasterExtensions } from '@/services/images/subservice/constants'

export const {
    internalOperations: ombulCoverImageOperations,
    specialCollectionPanelOperations: ombulCoversImagePanelOperations,
    generateCollectionFromConfig: generateOmbulCoversCollectionFromConfig
} = implementSpecialCollection({
    special: 'OMBULCOVERS',
    allowedExtensions: rasterExtensions,
    imagePanelAuth: ombulCoversImagePanelAuth,
    config: {
        name: 'Ombulforsider',
        description: 'Bilder brukt som forsider for ombul. Hvert bilde i denne samlingen tilhører nøyaktig én ombul.',
    }
})
