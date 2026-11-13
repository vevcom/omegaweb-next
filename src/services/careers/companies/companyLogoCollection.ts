import '@pn-server-only'
import { companyLogosImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { allowedExtensions } from '@/services/images/subservice/constants'

export const {
    internalOperations: companyLogoImageOperations,
    specialCollectionPanelOperations: companyLogosImagePanelOperations,
    generateCollectionFromConfig: generateCompanyLogosCollectionFromConfig
} = implementSpecialCollection({
    special: 'COMPANYLOGOS',
    // A logo comes as a vector as often as a raster image.
    allowedExtensions,
    imagePanelAuth: companyLogosImagePanelAuth,
    config: {
        name: 'Bedriftslogoer',
        description: 'Logoene til bedriftene på karrieresidene. Hvert bilde tilhører nøyaktig én bedrift.',
    }
})
