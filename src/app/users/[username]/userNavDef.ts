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
import { Require } from '@/auth/authorizer/Require'
import {
    faCircleDot,
    faCog,
    faHatWizard,
    faIdCard,
    faKey,
    faPaperPlane,
    faSwatchbook,
    faUser,
    faUsers,
} from '@fortawesome/free-solid-svg-icons'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

/** The user a page is about - everything a page's authorizers are allowed to key off. */
export type UserNavSubject = {
    username: string,
    userId: number,
}

export type UserNavItem = {
    name: string,
    icon: IconDefinition,
    /** Appended to `/users/${username}`. The profile itself is the bare path, so it has none. */
    path?: string,
    /**
     * One authorizer per thing the page lets you do, and passing **any** of them is enough to be
     * shown it - a page you can do something on is a page worth a link. The page then decides which
     * of its parts to render, since being able to do one thing there says nothing about the rest.
     *
     * The same list is what `getProfileForUserPage` guards the page with, so a link is never shown
     * to a page that would turn the viewer away.
     */
    authorizers: (subject: UserNavSubject) => Authorizer[],
}

/**
 * The pages that make up a user's own corner of the site, in the order they are shown.
 */
export const userNavDef: UserNavItem[] = [
    {
        name: 'Profil',
        icon: faUser,
        authorizers: ({ username }) => [userAuth.readProfile.data({ userField: { username } })],
    },
    {
        // Reading the trials is the floor: the level itself is on the profile anyway, so it is the
        // trials - and being able to act on them - that make this page worth opening.
        name: 'Medlemsstatus',
        icon: faIdCard,
        path: 'membership-status',
        authorizers: ({ userId }) => [
            admissionAuth.readTrial.data({ userId }),
            admissionAuth.createTrial,
            omegaMembershipGroupAuth.updateUserLevel,
            omegaMembershipGroupAuth.updateUserOrder,
        ],
    },
    {
        // Every group type guards its own memberships, and any one of them is something to show.
        name: 'Grupper',
        icon: faUsers,
        path: 'groups',
        authorizers: ({ userId }) => [
            omegaMembershipGroupAuth.readMembershipsOfUser.data({ userId }),
            classAuth.readMembershipsOfUser.data({ userId }),
            studyProgrammeAuth.readMembershipsOfUser.data({ userId }),
            committeeAuth.readMembershipsOfUser.data({ userId }),
            interestGroupAuth.readMembershipsOfUser.data({ userId }),
            manualGroupAuth.readMembershipsOfUser.data({ userId }),
        ],
    },
    {
        name: 'Prikker',
        icon: faCircleDot,
        path: 'dots',
        authorizers: ({ userId }) => [
            dotAuth.readForUser.data({ userId }),
            dotAuth.create.data({ userId }),
        ],
    },
    {
        name: 'Notifikasjoner',
        icon: faPaperPlane,
        path: 'notifications',
        authorizers: ({ userId }) => [
            notificationSubscriptionAuth.read.data({ userId }),
            notificationSubscriptionAuth.update.data({ userId }),
        ],
    },
    {
        name: 'Tilganger',
        icon: faKey,
        path: 'permissions',
        authorizers: ({ userId }) => [permissionsAuth.readPermissionsOfUser.data({ userId })],
    },
    {
        name: 'Kapper',
        icon: faHatWizard,
        path: 'flairs',
        authorizers: () => [flairAuth.assignToUser],
    },
    {
        name: 'Tema',
        icon: faSwatchbook,
        path: 'theme',
        authorizers: ({ username }) => [Require.userField().data({ userField: { username } })],
    },
    {
        name: 'Innstillinger',
        icon: faCog,
        path: 'settings',
        authorizers: ({ username, userId }) => [
            userAuth.updateProfile.data({ userField: { username } }),
            userAuth.updateBioParagraphContent.data({ userId }),
            userAuth.registerNewEmail.data({ userId }),
            userAuth.updateProfileImage.data({ userField: { username } }),
            userAuth.update,
            classAuth.changeClassOfUser,
            studyProgrammeAuth.update,
        ],
    },
]

/**
 * The items of the nav the session may open, in order.
 */
export function visibleUserNavItems(
    subject: UserNavSubject,
    authorize: (authorizer: Authorizer) => boolean,
): UserNavItem[] {
    return userNavDef.filter(item => item.authorizers(subject).some(authorize))
}
