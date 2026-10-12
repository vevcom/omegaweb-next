import '@pn-server-only'
import { promoImagesImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { allowedExtensions } from '@/services/images/subservice/constants'

export const {
    internalOperations: promoImageOperations,
    specialCollectionPanelOperations: promoImagesImagePanelOperations,
    generateCollectionFromConfig: generatePromoImagesCollectionFromConfig
} = implementSpecialCollection({
    special: 'PROMOIMAGES',
    allowedExtensions,
    imagePanelAuth: promoImagesImagePanelAuth,
    config: {
        name: 'Promobilder',
        description: 'Bakgrunnsbilder brukt av promo-baren på forsiden. Hvert bilde tilhører nøyaktig én promo.',
    }
})
