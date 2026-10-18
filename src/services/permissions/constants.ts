import { Permission } from '@/prisma-generated-pn-types'
import type { PermissionInfo } from './types'

export const permissionCategories = [
    'omega quotes',
    'ombul',
    'groups',
    'jobad',
    'diverse admin',
    'brukere',
    'bilder',
    'events',
    'notifikasjoner',
    'mail',
    'shop',
    'cabin',
    'permission',
    'applications',
    'public'
] as const satisfies string[]

export const permissionConfig = {
    OMEGAQUOTES_USE: {
        name: 'Bruke OmegaQuotes',
        description: 'kan lese og skrive OmegaQuotes',
        category: 'omega quotes',
        canBeDefault: true,
    },
    OMBUL_ADMIN: {
        name: 'Ombuladministrator',
        description: 'kan lage, oppdatere og slette ombul',
        category: 'ombul',
        canBeDefault: false,
    },
    OMBUL_USE: {
        name: 'Les ombul',
        description: 'kan lese ombul',
        category: 'ombul',
        canBeDefault: true,
    },
    OMEGA_MEMBERSHIP_GROUP_USE: {
        name: 'Les Omega medlemsgrupper',
        description: 'kan lese Omega medlemsgrupper',
        category: 'groups',
        canBeDefault: true,
    },
    OMEGA_MEMBERSHIP_GROUP_ADMIN: {
        name: 'Administrer Omega medlemsgrupper',
        description: 'kan endre hvilken medlemsgruppe en bruker tilhører',
        category: 'groups',
        canBeDefault: false,
    },
    CLASS_USE: {
        name: 'Les klasse',
        description: 'kan lese klasser',
        category: 'groups',
        canBeDefault: true,
    },
    CLASS_ADMIN: {
        name: 'Administrer klasser',
        description: 'kan endre hvilken klasse en bruker er i og rykke opp klassene',
        category: 'groups',
        canBeDefault: false,
    },
    COMMITTEE_USE: {
        name: 'Les komite',
        description: 'kan lese komiteer',
        category: 'groups',
        canBeDefault: true,
    },
    COMMITTEE_ADMIN: {
        name: 'Administrer komiteer',
        description: 'kan lage, endre og slette komiteer, og administrere medlemmene i dem',
        category: 'groups',
        canBeDefault: false,
    },
    INTEREST_GROUP_USE: {
        name: 'Les interessegruppe',
        description: 'kan lese interessegruppe',
        category: 'groups',
        canBeDefault: true,
    },
    INTEREST_GROUP_ADMIN: {
        name: 'Administrere interessegruppe',
        description: 'Administrere interessegruppe uten å være admin i gruppen. Og lage nye grupper',
        category: 'groups',
        canBeDefault: false,
    },
    STUDY_PROGRAMME_USE: {
        name: 'Les studieprogram',
        description: 'kan lese studieprogram',
        category: 'groups',
        canBeDefault: true,
    },
    STUDY_PROGRAMME_ADMIN: {
        name: 'Administrer studieprogram',
        description: 'kan lage, endre og slette studieprogram, og administrere medlemmene i dem',
        category: 'groups',
        canBeDefault: false,
    },
    MANUAL_GROUP_USE: {
        name: 'Les andre grupper',
        description: 'kan lese andre grupper',
        category: 'groups',
        canBeDefault: true,
    },
    MANUAL_GROUP_ADMIN: {
        name: 'Administrer andre grupper',
        description: 'kan opprette, oppdatere og slette andre grupper, og styre medlemmene deres',
        category: 'groups',
        canBeDefault: false,
    },
    JOBAD_ADMIN: {
        name: 'Jobbannonseadministrator',
        description: 'kan lage, oppdatere og slette jobbannonser',
        category: 'jobad',
        canBeDefault: false,
    },
    JOBAD_USE: {
        name: 'Les jobbannonser',
        description: 'kan lese jobbannonser',
        category: 'jobad',
        canBeDefault: true,
    },
    OMEGA_ORDER_ADMIN: {
        name: 'Omega orden administrator',
        description: 'kan inkrementere omega orden',
        category: 'diverse admin',
        canBeDefault: false,
    },
    OMEGA_ORDER_USE: {
        name: 'Les omega orden',
        description: 'kan lese omega orden',
        category: 'diverse admin',
        canBeDefault: true,
    },
    FRONTPAGE_ADMIN: {
        name: 'Frontpage administrator',
        description: 'kan administrere frontpage',
        category: 'public',
        canBeDefault: false,
    },
    NEW_STUDENT_ADMIN: {
        name: 'Administrere ny student siden',
        description: 'kan administrere artikkelen på ny student siden',
        category: 'public',
        canBeDefault: false,
    },
    REPORT_ADMIN: {
        name: 'Administrere varslingssiden',
        description: 'kan administrere artikkelen på varslingssiden',
        category: 'public',
        canBeDefault: false,
    },
    USERS_ADMIN: {
        name: 'Brukeradministrator',
        description: 'kan lage, oppdatere og slette brukere',
        category: 'brukere',
        canBeDefault: false,
    },
    USERS_USE: {
        name: 'Les bruker',
        description: 'kan lese brukere/profiler',
        category: 'brukere',
        canBeDefault: false,
    },
    IMAGE_ADMIN: {
        name: 'Bildeadministrator',
        description: `
            Kan administrere alle bilder, uavhengig av synelighet - dette er altså en bypass.
        `,
        category: 'bilder',
        canBeDefault: false,
    },
    IMAGE_CREATE: {
        name: 'Lage bilde samling',
        description: 'kan lage bilde samling',
        category: 'bilder',
        canBeDefault: false,
    },
    EVENT_ADMIN: {
        name: 'Eventadministrator',
        description: 'kan lage og administrere events, samt gi prikker for uteblivelse',
        category: 'events',
        canBeDefault: false,
    },
    EVENT_CREATE: {
        name: 'Lage events',
        description: 'kan lage nye events, men administrerer kun de som egen synlighet gir tilgang til',
        category: 'events',
        canBeDefault: false,
    },
    NOTIFICATION_ADMIN: {
        name: 'Notifikasjonsadministrator',
        description: 'kan lage notifikasjonskanaler og notifikasjoner, samt administrere andres abonnement',
        category: 'notifikasjoner',
        canBeDefault: false,
    },
    MAIL_USE: {
        name: 'Sende epost',
        description: 'kan sende epost',
        category: 'mail',
        canBeDefault: false,
    },
    MAILSERVER_USE: {
        name: 'Se e-postserveren',
        description: 'kan se e-postalias, e-postlister, eksterne e-postadresser og hvor e-post havner',
        category: 'mail',
        canBeDefault: false,
    },
    MAILSERVER_ADMIN: {
        name: 'Administrere e-postserveren',
        description: 'kan opprette, endre og slette e-postalias, e-postlister, eksterne adresser og koblingene mellom dem',
        category: 'mail',
        canBeDefault: false,
    },
    ADMISSION_USE: {
        name: 'Bruke opptakssystem',
        description: 'kan lage, lese og administrere opptaksprøver',
        category: 'brukere',
        canBeDefault: false,
    },
    APIKEY_ADMIN: {
        name: 'API nøkkel administrator',
        description: 'kan administrere API nøkler',
        category: 'diverse admin',
        canBeDefault: false,
    },
    LOCKER_USE: {
        name: 'Bruke skap',
        description: 'kan opprette skapreservasjoner',
        category: 'brukere',
        canBeDefault: true,
    },
    LOCKER_ADMIN: {
        name: 'Administrere skap',
        description: 'kan opprette og slette reservasjoner på veiene av andre samt opprette og slette selve skapene',
        category: 'diverse admin',
        canBeDefault: false,
    },
    COMPANY_ADMIN: {
        name: 'Bedriftsadministrator',
        description: 'kan administrere bedrifter',
        category: 'brukere',
        canBeDefault: false,
    },
    COMPANY_USE: {
        name: 'Les bedrifter',
        description: 'kan lese bedrifter',
        category: 'brukere',
        canBeDefault: true,
    },
    DOTS_ADMIN: {
        name: 'Prikkadministrator',
        description: 'kan administrere prikker',
        category: 'brukere',
        canBeDefault: false,
    },
    FLAIR_ADMIN: {
        name: 'Kappe redigering',
        description: `
            Opprette, endre og gi kapper`,
        category: 'brukere',
        canBeDefault: false,
    },
    SHOP_ADMIN: {
        name: 'Butikk administrator',
        description: `
            Kan opprette butikker, se og administrere 
            alle butikker uansett synlighet,
            og administrere produktkatalogen`,
        category: 'shop',
        canBeDefault: false,
    },
    PURCHASE_USE: {
        name: 'Gjennomfør kjøp',
        description: 'Kan gjennomføre et kjøp i en butikk',
        category: 'shop',
        canBeDefault: true,
    },
    PURCHASE_ADMIN: {
        name: 'Kan ta betalt i en butikk',
        description: 'Kan belaste andre brukerkontoer, når de handler i en butikk.',
        category: 'shop',
        canBeDefault: false,
    },
    LICENSE_ADMIN: {
        name: 'Lisensadministrator',
        description: `
            kan administrere lisenser. Alle som eier et bilde kan
            legge til en lisens uavhengig av denne tillatelsen
        `,
        category: 'diverse admin',
        canBeDefault: false,
    },
    CABIN_USE: {
        name: 'Bruke hytta',
        description: 'kan booke hytta/senger og lese hyttekalender',
        category: 'cabin',
        canBeDefault: true,
    },
    CABIN_ADMIN: {
        name: 'Hytteadministrator',
        description: 'kan administrere hytter, hyttebookinger og hytteprodukter',
        category: 'cabin',
        canBeDefault: false,
    },
    PERMISSION_ADMIN: {
        name: 'Administrere tilganger',
        description: 'Kan administrere tilganger til grupper og standardtilganger',
        category: 'permission',
        canBeDefault: false,
    },
    PERMISSION_USE: {
        name: 'Les tilganger til grupper',
        description: 'Kan lese tilganger til grupper',
        category: 'permission',
        canBeDefault: false,
    },
    APPLICATION_ADMIN: {
        name: 'Søknadsadministrator',
        description: `
            Lag søknadsperioder, les søknader og administrer/moderere søknader.
            Komitemedlemmer kan også lese søknader til sin komite.
        `,
        category: 'applications',
        canBeDefault: false,
    },
    APPLICATION_USE: {
        name: 'Søknadsskriver',
        description: `
            Kan skrive søknader til alle aktive søknadsperioder.
        `,
        category: 'applications',
        canBeDefault: true,
    },
    LEDGER_ADMIN: {
        name: 'Hovedbokadministratør',
        description: `
            Kan opprette overføringer fra/til og endre alle kontoer.
        `,
        category: 'diverse admin',
        canBeDefault: false,
    },
    LEDGER_USE: {
        name: 'Overføre og betale',
        description: `
            Tillater en bruker å utføre overføring av penger og betaling av varer og tjenester.
        `,
        category: 'diverse admin',
        canBeDefault: true,
    },
    NEWS_CREATE: {
        name: 'Lage nyhetsartikkel',
        description: 'kan lage nyhetsartikler',
        category: 'public',
        canBeDefault: false,
    },
    NEWS_ADMIN: {
        name: 'Nyhetsadministrator',
        description: 'kan administrere alle nyhetsartikler uavhengig av synlighet',
        category: 'public',
        canBeDefault: false,
    },
    ARTICLE_CATEGORY_ADMIN: {
        name: 'Artikkeladministrator',
        description: `
            Kan lage artikkelkategorier, og lese og redigere alle kategorier og artiklene i dem
            uavhengig av synlighet.
        `,
        category: 'public',
        canBeDefault: false,
    },
    BULSHIT_WRITE: {
        name: 'Lage bulshit',
        description: 'Kan sende inn bulshit',
        category: 'ombul',
        canBeDefault: true,
    },
    BULSHIT_USE: {
        name: 'Les bulshit',
        description: 'Kan lese bulshit',
        category: 'ombul',
        canBeDefault: true,
    },
} satisfies Record<Permission, PermissionInfo>

/**
 * The permissions that may be made default permissions, as `canBeDefault` in `permissionConfig` says.
 * A default permission is held by everyone - visitors who are not logged in too.
 */
export function permissionsAllowedAsDefault(): Permission[] {
    return Object.values(Permission).filter(permission => permissionConfig[permission].canBeDefault)
}
