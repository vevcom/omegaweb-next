import { standardStoreFiles } from '@/lib/standardStore/files'
import type { StandardStoreFile } from '@/lib/standardStore/files'
import type { StandardImage } from '@/prisma-generated-pn/enums'

export const standardImageConfig = {
    DEFAULT_IMAGE: {
        standardStoreFile: standardStoreFiles.defaultImage,
        name: 'default_image',
        alt: 'standard bilde (ikke funnet)',
    },
    DEFAULT_IMAGE_COLLECTION_COVER: {
        standardStoreFile: standardStoreFiles.album,
        name: 'Album',
        alt: 'Et kamera med en linse',
    },
    DEFAULT_PROFILE_IMAGE: {
        standardStoreFile: standardStoreFiles.magiskHatt,
        name: 'default_profile_image',
        alt: 'standard profilbilde (ikke funnet)',
    },
    DEFAULT_COMMITTEE_LOGO: {
        standardStoreFile: standardStoreFiles.logoSimple,
        name: 'default_committee_logo',
        alt: 'komité logo',
    },
    LOGO_SIMPLE: {
        standardStoreFile: standardStoreFiles.logoSimple,
        name: 'logo_simple',
        alt: 'Logo',
    },
    LOGO_WHITE: {
        standardStoreFile: standardStoreFiles.logoWhite,
        name: 'logo_white',
        alt: 'Logo',
    },
    LOGO_WHITE_TEXT: {
        standardStoreFile: standardStoreFiles.omegaLogoWhite,
        name: 'logo_white_text',
        alt: 'Logo',
    },
    MAGISK_HATT: {
        standardStoreFile: standardStoreFiles.magiskHatt,
        name: 'magisk_hatt',
        alt: 'Magisk hatt',
    },
    HOVEDBYGGNINGEN: {
        standardStoreFile: standardStoreFiles.hovedbygget,
        name: 'hovedbygningen',
        alt: 'Hovedbygningen',
    },
    BOOKS: {
        standardStoreFile: standardStoreFiles.books,
        name: 'Books',
        alt: 'Bøker',
    },
    MACHINE: {
        standardStoreFile: standardStoreFiles.machine,
        name: 'machine',
        alt: 'Maskin',
    },
    REALFAGSBYGGET: {
        standardStoreFile: standardStoreFiles.realfagsbygget,
        name: 'Realfagsbygget',
        alt: 'Realfagsbygget',
    },
    FAIR: {
        standardStoreFile: standardStoreFiles.fair,
        name: 'fair',
        alt: 'Fair',
    },
    PWA: {
        standardStoreFile: standardStoreFiles.pwa,
        name: 'pwa',
        alt: 'PWA',
    },
} as const satisfies Record<StandardImage, {
    standardStoreFile: StandardStoreFile
    name: string
    alt: string
}>
