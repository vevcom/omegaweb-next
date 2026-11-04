import '@pn-server-only'
import { standardImagesImagePanelAuth } from './auth'
import { implementSpecialCollection } from '@/services/images/subservice/special/implement'
import { allowedExtensions } from '@/services/images/subservice/constants'

export const {
    specialCollectionPanelOperations: standardImagesImagePanelOperations,
    generateCollectionFromConfig: generateStandardImagesCollectionFromConfig
} = implementSpecialCollection({
    special: 'STANDARDIMAGES',
    imagePanelAuth: standardImagesImagePanelAuth,
    allowedExtensions,
    config: {
        name: 'Standardbilder',
        description: `
            Bilder som er nødvendige for nettsiden.
            Denne samlingen er helt statisk og kan ikke endres.
            Mangler et standardbilde (et bilde i denne samlingen), genereres det på nytt
            fra den faste konfigurasjonen.
        `,
    }
})
