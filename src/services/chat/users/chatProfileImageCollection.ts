import '@ow-server-only'
import { chatProfileImagesImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { rasterExtensions } from '@/services/images/subservice/constants'

export const chatProfileImageCollection = implementSpecialCollection({
    special: 'CHATPROFILEIMAGES',
    allowedExtensions: rasterExtensions,
    imagePanelAuth: chatProfileImagesImagePanelAuth,
    config: {
        name: 'Chatbilder',
        description: 'Bilder brukt som profilbilder på chatten. Hvert bilde tilhører nøyaktig én chatkonto.',
    }
})
