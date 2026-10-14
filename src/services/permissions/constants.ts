import type { Permission } from '@/prisma-generated-pn-types'
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
    'skjermer',
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
    },
    OMBUL_ADMIN: {
        name: 'Ombuladministrator',
        description: 'kan lage, oppdatere og slette ombul',
        category: 'ombul',
    },
    OMBUL_USE: {
        name: 'Les ombul',
        description: 'kan lese ombul',
        category: 'ombul',
    },
    OMEGA_MEMBERSHIP_GROUP_USE: {
        name: 'Les Omega medlemsgrupper',
        description: 'kan lese Omega medlemsgrupper',
        category: 'groups',
    },
    OMEGA_MEMBERSHIP_GROUP_ADMIN: {
        name: 'Administrer Omega medlemsgrupper',
        description: 'kan endre hvilken medlemsgruppe en bruker tilhører',
        category: 'groups',
    },
    CLASS_USE: {
        name: 'Les klasse',
        description: 'kan lese klasser',
        category: 'groups',
    },
    CLASS_ADMIN: {
        name: 'Administrer klasser',
        description: 'kan endre hvilken klasse en bruker er i og rykke opp klassene',
        category: 'groups',
    },
    COMMITTEE_USE: {
        name: 'Les komite',
        description: 'kan lese komiteer',
        category: 'groups',
    },
    COMMITTEE_ADMIN: {
        name: 'Administrer komiteer',
        description: 'kan lage, endre og slette komiteer, og administrere medlemmene i dem',
        category: 'groups',
    },
    INTEREST_GROUP_USE: {
        name: 'Les interessegruppe',
        description: 'kan lese interessegruppe',
        category: 'groups',
    },
    INTEREST_GROUP_ADMIN: {
        name: 'Administrere interessegruppe',
        description: 'Administrere interessegruppe uten å være admin i gruppen. Og lage nye grupper',
        category: 'groups',
    },
    STUDY_PROGRAMME_USE: {
        name: 'Les studieprogram',
        description: 'kan lese studieprogram',
        category: 'groups',
    },
    STUDY_PROGRAMME_ADMIN: {
        name: 'Administrer studieprogram',
        description: 'kan lage, endre og slette studieprogram, og administrere medlemmene i dem',
        category: 'groups',
    },
    MANUAL_GROUP_USE: {
        name: 'Les andre grupper',
        description: 'kan lese andre grupper',
        category: 'groups',
    },
    MANUAL_GROUP_ADMIN: {
        name: 'Administrer andre grupper',
        description: 'kan opprette, oppdatere og slette andre grupper, og styre medlemmene deres',
        category: 'groups',
    },
    JOBAD_ADMIN: {
        name: 'Jobbannonseadministrator',
        description: 'kan lage, oppdatere og slette jobbannonser',
        category: 'jobad',
    },
    JOBAD_USE: {
        name: 'Les jobbannonser',
        description: 'kan lese jobbannonser',
        category: 'jobad',
    },
    OMEGA_ORDER_ADMIN: {
        name: 'Omega orden administrator',
        description: 'kan inkrementere omega orden',
        category: 'diverse admin',
    },
    OMEGA_ORDER_USE: {
        name: 'Les omega orden',
        description: 'kan lese omega orden',
        category: 'diverse admin',
    },
    FRONTPAGE_ADMIN: {
        name: 'Frontpage administrator',
        description: 'kan administrere frontpage',
        category: 'public',
    },
    NEW_STUDENT_ADMIN: {
        name: 'Administrere ny student siden',
        description: 'kan administrere artikkelen på ny student siden',
        category: 'public',
    },
    REPORT_ADMIN: {
        name: 'Administrere varslingssiden',
        description: 'kan administrere artikkelen på varslingssiden',
        category: 'public',
    },
    USERS_ADMIN: {
        name: 'Brukeradministrator',
        description: 'kan lage, oppdatere og slette brukere',
        category: 'brukere',
    },
    USERS_USE: {
        name: 'Les bruker',
        description: 'kan lese brukere/profiler',
        category: 'brukere',
    },
    IMAGE_ADMIN: {
        name: 'Bildeadministrator',
        description: `
            Kan administrere alle bilder, uavhengig av synelighet - dette er altså en bypass.
        `,
        category: 'bilder',
    },
    IMAGE_CREATE: {
        name: 'Lage bilde samling',
        description: 'kan lage bilde samling',
        category: 'bilder',
    },
    EVENT_ADMIN: {
        name: 'Eventadministrator',
        description: 'kan lage og administrere events, samt gi prikker for uteblivelse',
        category: 'events',
    },
    EVENT_CREATE: {
        name: 'Lage events',
        description: 'kan lage nye events, men administrerer kun de som egen synlighet gir tilgang til',
        category: 'events',
    },
    NOTIFICATION_ADMIN: {
        name: 'Notifikasjonsadministrator',
        description: 'kan lage notifikasjonskanaler og notifikasjoner, samt administrere andres abonnement',
        category: 'notifikasjoner',
    },
    MAIL_USE: {
        name: 'Sende epost',
        description: 'kan sende epost',
        category: 'mail',
    },
    MAILSERVER_USE: {
        name: 'Se e-postserveren',
        description: 'kan se e-postalias, e-postlister, eksterne e-postadresser og hvor e-post havner',
        category: 'mail',
    },
    MAILSERVER_ADMIN: {
        name: 'Administrere e-postserveren',
        description: 'kan opprette, endre og slette e-postalias, e-postlister, eksterne adresser og koblingene mellom dem',
        category: 'mail',
    },
    ADMISSION_USE: {
        name: 'Bruke opptakssystem',
        description: 'kan lage, lese og administrere opptaksprøver',
        category: 'brukere',
    },
    APIKEY_ADMIN: {
        name: 'API nøkkel administrator',
        description: 'kan administrere API nøkler',
        category: 'diverse admin',
    },
    SCREEN_ADMIN: {
        name: 'Skjermadministrator',
        description: 'kan administrere skjermer',
        category: 'skjermer',
    },
    SCREEN_USE: {
        name: 'Les skjermer',
        description: 'kan lese skjermer',
        category: 'skjermer',
    },
    SCHOOLS_USE: {
        name: 'Les skoler',
        description: 'kan lese skoler',
        category: 'brukere',
    },
    SCHOOLS_ADMIN: {
        name: 'Skoleadministrator',
        description: 'kan administrere skoler',
        category: 'brukere',
    },
    COURSES_USE: {
        name: 'Les emner',
        description: 'kan lese emner',
        category: 'brukere',
    },
    COURSES_ADMIN: {
        name: 'Emneadministrator',
        description: 'kan administrere emner',
        category: 'brukere',
    },
    LOCKER_USE: {
        name: 'Bruke skap',
        description: 'kan opprette skapreservasjoner',
        category: 'brukere'
    },
    LOCKER_ADMIN: {
        name: 'Administrere skap',
        description: 'kan opprette og slette reservasjoner på veiene av andre samt opprette og slette selve skapene',
        category: 'diverse admin'
    },
    COMPANY_ADMIN: {
        name: 'Bedriftsadministrator',
        description: 'kan administrere bedrifter',
        category: 'brukere'
    },
    COMPANY_USE: {
        name: 'Les bedrifter',
        description: 'kan lese bedrifter',
        category: 'brukere'
    },
    DOTS_ADMIN: {
        name: 'Prikkadministrator',
        description: 'kan administrere prikker',
        category: 'brukere'
    },
    FLAIR_ADMIN: {
        name: 'Kappe redigering',
        description: `
            Opprette, endre og gi kapper`,
        category: 'brukere',
    },
    SHOP_USE: {
        name: 'Les butikker',
        description: 'kan lese butikker',
        category: 'shop'
    },
    SHOP_ADMIN: {
        name: 'Butikk administrator',
        description: 'Kan administrere alle butikker',
        category: 'shop'
    },
    PRODUCT_USE: {
        name: 'Les produkter',
        description: 'Kan lese produkter',
        category: 'shop'
    },
    PRODUCT_ADMIN: {
        name: 'Produkt administrator',
        description: 'Kan administrare alle produkter',
        category: 'shop'
    },
    PURCHASE_USE: {
        name: 'Gjennomfør kjøp',
        description: 'Kan gjennomføre et kjøp i en butikk',
        category: 'shop'
    },
    PURCHASE_ADMIN: {
        name: 'Kan ta betalt i en butikk',
        description: 'Kan belaste andre brukerkontoer, når de handler i en butikk.',
        category: 'shop'
    },
    LICENSE_ADMIN: {
        name: 'Lisensadministrator',
        description: `
            kan administrere lisenser. Alle som eier et bilde kan
            legge til en lisens uavhengig av denne tillatelsen
        `,
        category: 'diverse admin'
    },
    CABIN_USE: {
        name: 'Bruke hytta',
        description: 'kan booke hytta/senger og lese hyttekalender',
        category: 'cabin'
    },
    CABIN_ADMIN: {
        name: 'Hytteadministrator',
        description: 'kan administrere hytter, hyttebookinger og hytteprodukter',
        category: 'cabin'
    },
    PERMISSION_ADMIN: {
        name: 'Administrere tilganger',
        description: 'Kan administrere tilganger til grupper og standardtilganger',
        category: 'permission'
    },
    PERMISSION_USE: {
        name: 'Les tilganger til grupper',
        description: 'Kan lese tilganger til grupper',
        category: 'permission'
    },
    APPLICATION_ADMIN: {
        name: 'Søknadsadministrator',
        description: `
            Lag søknadsperioder, les søknader og administrer/moderere søknader.
            Komitemedlemmer kan også lese søknader til sin komite.
        `,
        category: 'applications',
    },
    APPLICATION_USE: {
        name: 'Søknadsskriver',
        description: `
            Kan skrive søknader til alle aktive søknadsperioder.
        `,
        category: 'applications',
    },
    LEDGER_ADMIN: {
        name: 'Hovedbokadministratør',
        description: `
            Kan opprette overføringer fra/til og endre alle kontoer.
        `,
        category: 'diverse admin',
    },
    LEDGER_USE: {
        name: 'Overføre og betale',
        description: `
            Tillater en bruker å utføre overføring av penger og betaling av varer og tjenester.
        `,
        category: 'diverse admin',
    },
    NEWS_CREATE: {
        name: 'Lage nyhetsartikkel',
        description: 'kan lage nyhetsartikler',
        category: 'public',
    },
    NEWS_ADMIN: {
        name: 'Nyhetsadministrator',
        description: 'kan administrere alle nyhetsartikler uavhengig av synlighet',
        category: 'public',
    },
    ARTICLE_CATEGORY_ADMIN: {
        name: 'Artikkeladministrator',
        description: `
            Kan lage artikkelkategorier, og lese og redigere alle kategorier og artiklene i dem
            uavhengig av synlighet.
        `,
        category: 'public',
    },
    BULLSHIT_WRITE: {
        name: 'Lage bullshit',
        description: 'Kan sende inn bullshit',
        category: 'ombul',
    },
    BULLSHIT_USE: {
        name: 'Les bullshit',
        description: 'Kan lese bullshit',
        category: 'ombul',
    },
} satisfies Record<Permission, PermissionInfo>
