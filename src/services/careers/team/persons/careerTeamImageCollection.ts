import '@ow-server-only'
import { careerTeamImagesImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { rasterExtensions } from '@/services/images/subservice/constants'

export const careerTeamImageCollection = implementSpecialCollection({
    special: 'CAREERTEAMIMAGES',
    allowedExtensions: rasterExtensions,
    imagePanelAuth: careerTeamImagesImagePanelAuth,
    config: {
        name: 'Karriereteamet',
        description: 'Portretter av teamet på karrieresidene. Hvert bilde tilhører nøyaktig én person.',
    }
})
