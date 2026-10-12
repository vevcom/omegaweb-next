import { userAuth } from '@/services/users/auth'
import { admissionAuth } from '@/services/admission/auth'
import { omegaOrderAuth } from '@/services/omegaOrder/auth'
import { classAuth } from '@/services/groups/classes/auth'
import { committeeAuth } from '@/services/groups/committees/auth'
import { interestGroupAuth } from '@/services/groups/interestGroups/auth'
import { omegaMembershipGroupAuth } from '@/services/groups/omegaMembershipGroups/auth'
import { studyProgrammeAuth } from '@/services/groups/studyProgrammes/auth'
import { manualGroupAuth } from '@/services/groups/manualGroups/auth'
import { permissionsAuth } from '@/services/permissions/auth'
import { apiKeyAuth } from '@/services/apiKeys/auth'
import { notificationAuth } from '@/services/notifications/auth'
import { sendMailAuth } from '@/services/notifications/send-mail/auth'
import { notificationChannelAuth } from '@/services/notifications/channel/auth'
import { mailAliasAuth } from '@/services/mail/alias/auth'
import { mailingListAuth } from '@/services/mail/list/auth'
import { mailAddressExternalAuth } from '@/services/mail/mailAddressExternal/auth'
import { schoolAuth } from '@/services/education/schools/auth'
import { dotAuth } from '@/services/dots/auth'
import { dotFreezePeriodAuth } from '@/services/dots/freezePeriods/auth'
import { cabinPricePeriodAuth } from '@/services/cabin/pricePeriod/auth'
import { cabinReleasePeriodAuth } from '@/services/cabin/releasePeriod/auth'
import { cabinProductAuth } from '@/services/cabin/product/auth'
import { cabinBookingAuth } from '@/services/cabin/booking/auth'
import { shopAuth } from '@/services/shop/shop/auth'
import { productAuth } from '@/services/shop/product/auth'
import { ledgerAccountAuth } from '@/services/ledger/accounts/auth'
import { promoAuth } from '@/services/promo/auth'
import { licenseAuth } from '@/services/licenses/auth'
import { flairAuth } from '@/services/flairs/auth'
import { Require } from '@/auth/authorizer/Require'
import {
    faChild,
    faKey,
    faUser,
    faUserGroup,
    faPaperPlane,
    faEnvelopesBulk,
    faSchool,
    faDotCircle,
    faHouse,
    faShop,
    faListDots,
    faMoneyBillWave,
} from '@fortawesome/free-solid-svg-icons'
import type { Authorizer, UserRequiredOutOpt } from '@/auth/authorizer/Authorizer'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

export type AdminNavLink = {
    title: string,
    /** Appended to `/admin`. */
    path: string,
    /**
     * One authorizer per thing the page lets you administer, and passing **any** of them is enough
     * to be shown it. They are the administering authorizers rather than the reading ones on
     * purpose: reads are routinely granted as default permissions, and a read alone would put the
     * admin button in front of everyone.
     *
     * The same list is what `authorizeAdminPage` guards the page with, so a link is never shown to
     * a page that would turn the viewer away.
     */
    authorizers: () => Authorizer<UserRequiredOutOpt, object | undefined>[],
}

export type AdminNavGroup = {
    header: {
        icon: IconDefinition,
        title: string,
    },
    links: AdminNavLink[],
}

/**
 * The admin pages, grouped and in the order the sidebar shows them.
 */
export const adminNavDef: AdminNavGroup[] = [
    {
        header: { icon: faUser, title: 'Brukere' },
        links: [
            {
                title: 'Brukere',
                path: 'users',
                authorizers: () => [userAuth.create],
            },
        ],
    },
    {
        header: { icon: faChild, title: 'Opptak og tilstand' },
        links: [
            {
                title: 'Opptak',
                path: 'admission',
                authorizers: () => [
                    admissionAuth.createTrial,
                    omegaMembershipGroupAuth.updateUserLevel,
                    omegaMembershipGroupAuth.updateUserOrder,
                ],
            },
            {
                title: 'Omegas tilstand',
                path: 'stateOfOmega',
                authorizers: () => [omegaOrderAuth.create],
            },
        ],
    },
    {
        header: { icon: faUserGroup, title: 'Grupper' },
        links: [
            {
                title: 'Klasser',
                path: 'classes',
                authorizers: () => [
                    classAuth.bumpClasses,
                    classAuth.changeClassOfUser,
                ],
            },
            {
                title: 'Komitéer',
                path: 'committees',
                authorizers: () => [
                    committeeAuth.create,
                    committeeAuth.update,
                ],
            },
            {
                title: 'Interessegrupper',
                path: 'interest-groups',
                authorizers: () => [interestGroupAuth.create],
            },
            {
                title: 'Medlemsgrupper',
                path: 'omega-membership-groups',
                authorizers: () => [
                    omegaMembershipGroupAuth.updateUserLevel,
                    omegaMembershipGroupAuth.updateUserOrder,
                ],
            },
            {
                title: 'Studieprogrammer',
                path: 'study-programmes',
                authorizers: () => [
                    studyProgrammeAuth.create,
                    studyProgrammeAuth.update,
                ],
            },
            {
                title: 'Andre grupper',
                path: 'manual-groups',
                authorizers: () => [
                    manualGroupAuth.create,
                    manualGroupAuth.update,
                ],
            },
        ],
    },
    {
        header: { icon: faKey, title: 'Tillgangsstyring' },
        links: [
            {
                title: 'Gruppe Tilganger',
                path: 'group-permissions',
                authorizers: () => [permissionsAuth.updateGroupPermission],
            },
            {
                title: 'Standard Tilganger',
                path: 'default-permissions',
                authorizers: () => [permissionsAuth.updateDefaultPermissions],
            },
            {
                title: 'API Nøkler',
                path: 'api-keys',
                authorizers: () => [apiKeyAuth.readMany],
            },
        ],
    },
    {
        header: { icon: faPaperPlane, title: 'Varslinger' },
        links: [
            {
                title: 'Varslingkanaler',
                path: 'notification-channels',
                authorizers: () => [
                    notificationChannelAuth.create,
                    notificationChannelAuth.update,
                ],
            },
            {
                title: 'Send varsel',
                path: 'send-notification',
                authorizers: () => [notificationAuth.create],
            },
            {
                title: 'Send e-post',
                path: 'send-mail',
                authorizers: () => [sendMailAuth.sendMail],
            },
        ],
    },
    {
        header: { icon: faEnvelopesBulk, title: 'Mailing tjener' },
        links: [
            {
                title: 'E-postlister',
                path: 'mail/mailingList',
                authorizers: () => [mailingListAuth.readMany],
            },
            {
                title: 'E-postalias',
                path: 'mail/alias',
                authorizers: () => [mailAliasAuth.readMany],
            },
            {
                title: 'Eksterne adresser',
                path: 'mail/mailaddressExternal',
                authorizers: () => [mailAddressExternalAuth.readMany],
            },
        ],
    },
    {
        header: { icon: faSchool, title: 'Fagvev' },
        links: [
            {
                title: 'Skoler',
                path: 'schools',
                authorizers: () => [
                    schoolAuth.create,
                    schoolAuth.update,
                ],
            },
            {
                // Courses have no service of their own yet, so the permission is required directly.
                title: 'Emnekatalog',
                path: 'courses',
                authorizers: () => [Require.permission('COURSES_ADMIN')],
            },
        ],
    },
    {
        header: { icon: faDotCircle, title: 'Prikker' },
        links: [
            {
                title: 'Prikker',
                path: 'dots',
                authorizers: () => [
                    dotAuth.update,
                    dotAuth.destroy,
                ],
            },
            {
                title: 'Frysperioder',
                path: 'dots-freeze-periods',
                authorizers: () => [
                    dotFreezePeriodAuth.create,
                    dotFreezePeriodAuth.update,
                ],
            },
        ],
    },
    {
        header: { icon: faHouse, title: 'Heutte' },
        links: [
            {
                title: 'Perioder',
                path: 'cabin-periods',
                authorizers: () => [
                    cabinReleasePeriodAuth.readMany,
                    cabinPricePeriodAuth.readMany,
                ],
            },
            {
                title: 'Produkter',
                path: 'cabin-product',
                authorizers: () => [cabinProductAuth.create],
            },
            {
                title: 'Bookinger',
                path: 'cabin-booking',
                authorizers: () => [cabinBookingAuth.readMany],
            },
        ],
    },
    {
        header: { icon: faShop, title: 'Shop' },
        links: [
            {
                title: 'Butikker',
                path: 'shop',
                authorizers: () => [shopAuth.create],
            },
            {
                title: 'Produkter',
                path: 'product',
                authorizers: () => [
                    productAuth.create,
                    productAuth.update,
                ],
            },
        ],
    },
    {
        header: { icon: faMoneyBillWave, title: 'Økonomi' },
        links: [
            {
                title: 'Kontoer',
                path: 'accounts',
                authorizers: () => [ledgerAccountAuth.readPage],
            },
        ],
    },
    {
        header: { icon: faListDots, title: 'Annet' },
        links: [
            {
                title: 'Promo',
                path: 'promo',
                authorizers: () => [promoAuth.readAll],
            },
            {
                title: 'Lisenser',
                path: 'licenses',
                authorizers: () => [
                    licenseAuth.create,
                    licenseAuth.update,
                ],
            },
            {
                title: 'Flairs',
                path: 'flairs',
                authorizers: () => [
                    flairAuth.create,
                    flairAuth.update,
                ],
            },
            {
                // A showcase with nothing of its own to administer: it is for whoever administers
                // anything else, and must not be what puts the admin button in front of someone.
                title: 'Komponenter',
                path: 'component-test',
                authorizers: () => adminNavAuthorizers({ except: 'component-test' }),
            },
        ],
    },
]

/**
 * Every authorizer in the admin nav - passing any of them is what it takes to have an admin page to
 * open at all.
 */
export function adminNavAuthorizers(
    { except }: { except?: string } = {}
): Authorizer<UserRequiredOutOpt, object | undefined>[] {
    return adminNavDef.flatMap(group => group.links)
        .filter(link => link.path !== except)
        .flatMap(link => link.authorizers())
}

/**
 * The groups of the admin nav with only the links the session may open, leaving out groups with
 * none left.
 */
export function visibleAdminNav(session: SessionMaybeUser): AdminNavGroup[] {
    return adminNavDef
        .map(group => ({
            ...group,
            links: group.links.filter(link => link.authorizers().some(
                authorizer => authorizer.auth(session).authorized
            )),
        }))
        .filter(group => group.links.length > 0)
}
