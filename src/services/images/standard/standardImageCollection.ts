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
            Denne koleksjonen er helt \'statisk\' og skal og kan ikke modifiseres.
            Dersom et standardbilde (et bilde i denne kolleksjonen) mangler vil bildet genereres ut fra
            sin statisk bestemte konfigurasjon.
        `,
    }
})
