import '@pn-server-only'
import { cmsPersonImagesImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { rasterExtensions } from '@/services/images/subservice/constants'

export const {
    internalOperations: cmsPersonImageOperations,
    specialCollectionPanelOperations: cmsPersonImagesImagePanelOperations,
    generateCollectionFromConfig: generateCmsPersonImagesCollectionFromConfig
} = implementSpecialCollection({
    special: 'PERSONIMAGES',
    allowedExtensions: rasterExtensions,
    imagePanelAuth: cmsPersonImagesImagePanelAuth,
    config: {
        name: 'Personbilder',
        description: 'Portretter av personer vist på sider, for eksempel teamet på karrieresidene. '
            + 'Hvert bilde i denne samlingen tilhører nøyaktig én person.',
    }
})
