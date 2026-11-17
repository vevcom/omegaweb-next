import '@ow-server-only'
import { profileImagesImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { rasterExtensions } from '@/services/images/subservice/constants'

export const profileImageCollection = implementSpecialCollection({
    special: 'PROFILEIMAGES',
    allowedExtensions: rasterExtensions,
    imagePanelAuth: profileImagesImagePanelAuth,
    config: {
        name: 'Profilbilder',
        description: 'Bilder brukt som profilbilder. Hvert bilde i denne samlingen tilhører nøyaktig én bruker.',
    }
})
