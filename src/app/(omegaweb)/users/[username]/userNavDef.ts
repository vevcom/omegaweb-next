import { userAuth } from '@/services/users/auth'
import { permissionsAuth } from '@/services/permissions/auth'
import { flairAuth } from '@/services/flairs/auth'
import { dotAuth } from '@/services/dots/auth'
import { admissionAuth } from '@/services/admission/auth'
import { omegaMembershipGroupAuth } from '@/services/groups/omegaMembershipGroups/auth'
import { notificationSubscriptionAuth } from '@/services/notifications/subscription/auth'
import { classAuth } from '@/services/groups/classes/auth'
import { studyProgrammeAuth } from '@/services/groups/studyProgrammes/auth'
import { committeeAuth } from '@/services/groups/committees/auth'
import { interestGroupAuth } from '@/services/groups/interestGroups/auth'
import { manualGroupAuth } from '@/services/groups/manualGroups/auth'
import { omegaIdAuth } from '@/services/omegaid/auth'
import { eventRegistrationAuth } from '@/services/events/registration/auth'
import { mailAliasAuth } from '@/services/mail/alias/auth'
import { Require } from '@/auth/authorizer/Require'
import { omegaLinks } from '@/app/(omegaweb)/links'
import { defineNavDef } from '@/lib/navDef/navDef'
import { appHref } from '@/lib/sites/href'
import {
    faCalendarCheck,
    faCircleDot,
    faEnvelope,
    faHatWizard,
    faIdCard,
    faKey,
    faMoneyBill,
    faPaperPlane,
    faQrcode,
    faSliders,
    faSwatchbook,
    faUser,
    faUsers,
} from '@fortawesome/free-solid-svg-icons'

/** The user a page is about - everything a page's authorizers are allowed to key off. */
export type UserNavSubject = {
    username: string,
    userId: number,
}

/**
 * The pages that make up a user's own corner of the site, in two navs and in the order they are
 * shown, with `all` for what goes for both.
 *
 * Each item has one authorizer per thing the page lets you do, as a page you can do something on is
 * a page worth a link. The page then decides which of its parts to render, since being able to do
 * one thing there says nothing about the rest.
 */
export function userNavDef({ username, userId }: UserNavSubject) {
    /**
     * What being a member is about: who you are, your ID, your money, your standing and your groups.
     * Shown in the island at the bottom of every user page.
     */
    const membership = defineNavDef([
        {
            key: 'profile',
            name: 'Profil',
            href: omegaLinks.user({ username }),
            icon: faUser,
            authorizers: () => [userAuth.readProfile.data({ userField: { username } })],
        },
        {
            key: 'omegaid',
            name: 'Omega-ID',
            href: appHref(`/users/${username}/omegaid`),
            icon: faQrcode,
            authorizers: () => [omegaIdAuth.generate.data({ userId })],
        },
        {
            key: 'registrations',
            name: 'Påmeldinger',
            href: appHref(`/users/${username}/registrations`),
            icon: faCalendarCheck,
            authorizers: () => [eventRegistrationAuth.readUpcomingOfUser.data({ userId })],
        },
        {
            key: 'mail',
            // Your address and the aliases you receive mail on: yours alone, as the mail is. A user
            // admin gets in to change the address, and sees no aliases.
            name: 'E-post',
            href: appHref(`/users/${username}/mail`),
            icon: faEnvelope,
            authorizers: () => [mailAliasAuth.readReceived.data({ userId }), userAuth.updateVevenMailAddress],
        },
        {
            key: 'account',
            // The page only ever shows the session user's own account.
            name: 'Konto',
            href: appHref(`/users/${username}/account`),
            icon: faMoneyBill,
            authorizers: () => [Require.userId().data({ userId })],
        },
        {
            key: 'membership-status',
            // Reading the trials is the floor: the level itself is on the profile anyway, so it is the
            // trials - and being able to act on them - that make this page worth opening.
            name: 'Medlemsstatus',
            href: appHref(`/users/${username}/membership-status`),
            icon: faIdCard,
            authorizers: () => [
                admissionAuth.readTrial.data({ userId }),
                admissionAuth.createTrial,
                omegaMembershipGroupAuth.updateUserLevel,
                omegaMembershipGroupAuth.updateUserOrder,
            ],
        },
        {
            key: 'groups',
            // Every group type guards its own memberships, and any one of them is something to show.
            name: 'Grupper',
            href: appHref(`/users/${username}/groups`),
            icon: faUsers,
            authorizers: () => [
                omegaMembershipGroupAuth.readMembershipsOfUser.data({ userId }),
                classAuth.readMembershipsOfUser.data({ userId }),
                studyProgrammeAuth.readMembershipsOfUser.data({ userId }),
                committeeAuth.readMembershipsOfUser.data({ userId }),
                interestGroupAuth.readMembershipsOfUser.data({ userId }),
                manualGroupAuth.readMembershipsOfUser.data({ userId }),
            ],
        },
        {
            key: 'dots',
            name: 'Prikker',
            href: appHref(`/users/${username}/dots`),
            icon: faCircleDot,
            authorizers: () => [
                dotAuth.readForUser.data({ userId }),
                dotAuth.create.data({ userId }),
            ],
        },
    ])

    /**
     * How the user is set up on the site: its settings, what it may do and its flairs, which is also
     * where administrators manage someone. Shown on the profile as one settings button under the log
     * out button, which unfolds into these.
     */
    const settings = defineNavDef([
        {
            key: 'settings',
            name: 'Generelt',
            href: appHref(`/users/${username}/settings`),
            icon: faSliders,
            authorizers: () => [
                userAuth.updateProfile.data({ userField: { username } }),
                userAuth.updateBioParagraphContent.data({ userId }),
                userAuth.registerNewEmail.data({ userId }),
                userAuth.updateProfileImage.data({ userField: { username } }),
                userAuth.update,
                classAuth.changeClassOfUser,
                studyProgrammeAuth.update,
            ],
        },
        {
            key: 'notifications',
            name: 'Varslinger',
            href: appHref(`/users/${username}/notifications`),
            icon: faPaperPlane,
            authorizers: () => [
                notificationSubscriptionAuth.read.data({ userId }),
                notificationSubscriptionAuth.update.data({ userId }),
            ],
        },
        {
            key: 'theme',
            name: 'Tema',
            href: appHref(`/users/${username}/theme`),
            icon: faSwatchbook,
            authorizers: () => [userAuth.updateTheme.data({ userField: { username } })],
        },
        {
            key: 'permissions',
            name: 'Tilganger',
            href: appHref(`/users/${username}/permissions`),
            icon: faKey,
            authorizers: () => [permissionsAuth.readPermissionsOfUser.data({ userId })],
        },
        {
            key: 'flairs',
            name: 'Kapper',
            href: appHref(`/users/${username}/flairs`),
            icon: faHatWizard,
            authorizers: () => [flairAuth.assignToUser],
        },
    ])

    return { membership, settings, all: defineNavDef([...membership.items, ...settings.items]) }
}

/** The keys of the pages under a user, which are their paths there. The profile is the user itself. */
export type UserNavPath = Exclude<Parameters<ReturnType<typeof userNavDef>['all']['authorize']>[0], 'profile'>
