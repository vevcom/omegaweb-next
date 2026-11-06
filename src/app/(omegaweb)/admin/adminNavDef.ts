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
import { sendMailAuth } from '@/services/notifications/sendMail/auth'
import { manualNotificationChannelAuth } from '@/services/notifications/channels/manual/auth'
import { mailAliasAuth } from '@/services/mail/alias/auth'
import { mailingListAuth } from '@/services/mail/list/auth'
import { mailAddressExternalAuth } from '@/services/mail/mailAddressExternal/auth'
import { dotAuth } from '@/services/dots/auth'
import { dotFreezePeriodAuth } from '@/services/dots/freezePeriods/auth'
import { cabinPricePeriodAuth } from '@/services/cabin/pricePeriod/auth'
import { cabinReleasePeriodAuth } from '@/services/cabin/releasePeriod/auth'
import { cabinProductAuth } from '@/services/cabin/product/auth'
import { cabinBookingAuth } from '@/services/cabin/booking/auth'
import { ledgerAccountAuth } from '@/services/ledger/accounts/auth'
import { manualReviewAuth } from '@/services/ledger/transactions/manualReviews/auth'
import { promoAuth } from '@/services/promo/auth'
import { licenseAuth } from '@/services/licenses/auth'
import { flairAuth } from '@/services/flairs/auth'
import { lockerAuth } from '@/services/lockers/auth'
import { lockerLocationAuth } from '@/services/lockers/locations/auth'
import { defineGroupedNavDef } from '@/lib/navDef/groupedNavDef'
import { appHref } from '@/lib/sites/href'
import {
    faChild,
    faKey,
    faUser,
    faUserGroup,
    faPaperPlane,
    faEnvelopesBulk,
    faDotCircle,
    faHouse,
    faListDots,
    faMoneyBillWave,
} from '@fortawesome/free-solid-svg-icons'
import type { NavAuthorizer } from '@/lib/navDef/navDef'

/**
 * The admin pages, grouped and in the order the sidebar shows them, keyed by their path under `/admin`.
 *
 * Each item has one authorizer per thing the page lets you administer. They are the administering
 * authorizers rather than the reading ones on purpose: reads are routinely granted as default
 * permissions, and a read alone would put the admin button in front of everyone.
 *
 * Being let in says nothing about which parts of a page to render. That is the page's own job: it
 * re-runs the authorizers it cares about against the session.
 */
export const adminNavDef = defineGroupedNavDef([
    {
        header: { icon: faUser, title: 'Brukere' },
        items: [
            {
                key: 'users',
                name: 'Brukere',
                href: appHref('/admin/users'),
                authorizers: () => [userAuth.create],
            },
            {
                key: 'users/archived',
                name: 'Arkiverte brukere',
                href: appHref('/admin/users/archived'),
                authorizers: () => [userAuth.readArchivedPage],
            },
        ],
    },
    {
        header: { icon: faChild, title: 'Opptak og tilstand' },
        items: [
            {
                key: 'admission',
                name: 'Opptak',
                href: appHref('/admin/admission'),
                authorizers: () => [
                    admissionAuth.createTrial,
                    omegaMembershipGroupAuth.updateUserLevel,
                    omegaMembershipGroupAuth.updateUserOrder,
                ],
            },
            {
                key: 'state-of-omega',
                name: 'Omegas tilstand',
                href: appHref('/admin/state-of-omega'),
                authorizers: () => [omegaOrderAuth.create],
            },
        ],
    },
    {
        header: { icon: faUserGroup, title: 'Grupper' },
        items: [
            {
                key: 'classes',
                name: 'Klasser',
                href: appHref('/admin/classes'),
                authorizers: () => [
                    classAuth.bumpClasses,
                    classAuth.changeClassOfUser,
                ],
            },
            {
                key: 'committees',
                name: 'Komitéer',
                href: appHref('/admin/committees'),
                authorizers: () => [
                    committeeAuth.create,
                    committeeAuth.update,
                ],
            },
            {
                key: 'interest-groups',
                name: 'Interessegrupper',
                href: appHref('/admin/interest-groups'),
                authorizers: () => [interestGroupAuth.create],
            },
            {
                key: 'omega-membership-groups',
                name: 'Medlemsgrupper',
                href: appHref('/admin/omega-membership-groups'),
                authorizers: () => [
                    omegaMembershipGroupAuth.updateUserLevel,
                    omegaMembershipGroupAuth.updateUserOrder,
                ],
            },
            {
                key: 'study-programmes',
                name: 'Studieprogrammer',
                href: appHref('/admin/study-programmes'),
                authorizers: () => [
                    studyProgrammeAuth.create,
                    studyProgrammeAuth.update,
                ],
            },
            {
                key: 'manual-groups',
                name: 'Andre grupper',
                href: appHref('/admin/manual-groups'),
                authorizers: () => [
                    manualGroupAuth.create,
                    manualGroupAuth.update,
                ],
            },
        ],
    },
    {
        header: { icon: faKey, title: 'Tilgangsstyring' },
        items: [
            {
                key: 'group-permissions',
                name: 'Gruppetilganger',
                href: appHref('/admin/group-permissions'),
                authorizers: () => [permissionsAuth.updateGroupPermission],
            },
            {
                key: 'default-permissions',
                name: 'Standardtilganger',
                href: appHref('/admin/default-permissions'),
                authorizers: () => [permissionsAuth.updateDefaultPermissions],
            },
            {
                key: 'api-keys',
                name: 'API-nøkler',
                href: appHref('/admin/api-keys'),
                authorizers: () => [apiKeyAuth.readMany],
            },
        ],
    },
    {
        header: { icon: faPaperPlane, title: 'Varslinger' },
        items: [
            {
                key: 'notification-channels',
                name: 'Varslingskanaler',
                href: appHref('/admin/notification-channels'),
                authorizers: () => [
                    manualNotificationChannelAuth.create,
                    manualNotificationChannelAuth.update,
                ],
            },
            {
                key: 'send-notification',
                name: 'Send varsel',
                href: appHref('/admin/send-notification'),
                authorizers: () => [manualNotificationChannelAuth.createNotification],
            },
            {
                key: 'send-mail',
                name: 'Send e-post',
                href: appHref('/admin/send-mail'),
                authorizers: () => [sendMailAuth.sendMail],
            },
        ],
    },
    {
        header: { icon: faEnvelopesBulk, title: 'E-posttjener' },
        items: [
            {
                key: 'mail/mailingList',
                name: 'E-postlister',
                href: appHref('/admin/mail/mailingList'),
                authorizers: () => [mailingListAuth.readMany],
            },
            {
                key: 'mail/alias',
                name: 'E-postalias',
                href: appHref('/admin/mail/alias'),
                authorizers: () => [mailAliasAuth.readMany],
            },
            {
                key: 'mail/mailaddressExternal',
                name: 'Eksterne adresser',
                href: appHref('/admin/mail/mailaddressExternal'),
                authorizers: () => [mailAddressExternalAuth.readMany],
            },
        ],
    },
    {
        header: { icon: faDotCircle, title: 'Prikker' },
        items: [
            {
                key: 'dots',
                name: 'Prikker',
                href: appHref('/admin/dots'),
                authorizers: () => [
                    dotAuth.update,
                    dotAuth.destroy,
                ],
            },
            {
                key: 'dots-freeze-periods',
                name: 'Frysperioder',
                href: appHref('/admin/dots-freeze-periods'),
                authorizers: () => [
                    dotFreezePeriodAuth.create,
                    dotFreezePeriodAuth.update,
                ],
            },
        ],
    },
    {
        header: { icon: faHouse, title: 'Heutte' },
        items: [
            {
                key: 'cabin-periods',
                name: 'Perioder',
                href: appHref('/admin/cabin-periods'),
                authorizers: () => [
                    cabinReleasePeriodAuth.readMany,
                    cabinPricePeriodAuth.readMany,
                ],
            },
            {
                key: 'cabin-product',
                name: 'Produkter',
                href: appHref('/admin/cabin-product'),
                authorizers: () => [cabinProductAuth.create],
            },
            {
                key: 'cabin-booking',
                name: 'Bookinger',
                href: appHref('/admin/cabin-booking'),
                authorizers: () => [cabinBookingAuth.readMany],
            },
        ],
    },
    {
        header: { icon: faMoneyBillWave, title: 'Økonomi' },
        items: [
            {
                key: 'accounts',
                name: 'Kontoer',
                href: appHref('/admin/accounts'),
                authorizers: () => [ledgerAccountAuth.readPage],
            },
            {
                key: 'ledger-review',
                name: 'Trenger oppfølging',
                href: appHref('/admin/ledger-review'),
                authorizers: () => [manualReviewAuth.readOpen],
            },
        ],
    },
    {
        header: { icon: faListDots, title: 'Annet' },
        items: [
            {
                key: 'promo',
                name: 'Promo',
                href: appHref('/admin/promo'),
                authorizers: () => [promoAuth.readAll],
            },
            {
                key: 'licenses',
                name: 'Lisenser',
                href: appHref('/admin/licenses'),
                authorizers: () => [
                    licenseAuth.create,
                    licenseAuth.update,
                ],
            },
            {
                key: 'flairs',
                name: 'Flairs',
                href: appHref('/admin/flairs'),
                authorizers: () => [
                    flairAuth.create,
                    flairAuth.update,
                ],
            },
            {
                key: 'lockers',
                name: 'Skap',
                href: appHref('/admin/lockers'),
                authorizers: () => [
                    lockerAuth.create,
                    lockerLocationAuth.create,
                ],
            },
            {
                key: 'component-test',
                // A showcase with nothing of its own to administer: it is for whoever administers
                // anything else, and must not be what puts the admin button in front of someone.
                name: 'Komponenter',
                href: appHref('/admin/component-test'),
                authorizers: () => authorizersOfOtherPages(),
            },
        ],
    },
])

function authorizersOfOtherPages(): NavAuthorizer[] {
    return adminNavDef.authorizers({ except: 'component-test' })
}
