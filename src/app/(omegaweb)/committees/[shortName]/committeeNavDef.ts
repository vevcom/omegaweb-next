import { committeeAuth } from '@/services/groups/committees/auth'
import { committeeParticipationAuth } from '@/services/applications/committeeParticipation/auth'
import { Require } from '@/auth/authorizer/Require'
import { defineNavDef } from '@/lib/navDef/navDef'
import { appHref } from '@/lib/sites/href'
import { omegaLinks } from '@/app/(omegaweb)/links'
import { faCog, faComments, faHome, faInfo, faScroll, faUsers } from '@fortawesome/free-solid-svg-icons'

/** The pages of a committee, in the order they are shown. */
export function committeeNavDef({ shortName, groupId }: { shortName: string, groupId: number }) {
    return defineNavDef([
        {
            key: 'frontpage',
            name: 'Forside',
            href: omegaLinks.committee({ shortName }),
            icon: faHome,
            authorizers: () => [committeeAuth.read],
        },
        {
            key: 'admin',
            name: 'Innstillinger',
            href: appHref(`/committees/${shortName}/admin`),
            icon: faCog,
            authorizers: () => [Require.allOf(committeeAuth.readExpanded, committeeAuth.readMembers.data({ groupId }))],
        },
        {
            key: 'application-periods',
            name: 'Søknadsperioder',
            href: appHref(`/committees/${shortName}/application-periods`),
            icon: faScroll,
            authorizers: () => [committeeParticipationAuth.readAll.data({ groupId })],
        },
        {
            key: 'members',
            name: 'Medlemmer',
            href: appHref(`/committees/${shortName}/members`),
            icon: faUsers,
            authorizers: () => [committeeAuth.readMembers.data({ groupId })],
        },
        {
            key: 'chat',
            name: 'Chat',
            href: appHref(`/committees/${shortName}/chat`),
            icon: faComments,
            authorizers: () => [committeeAuth.readChatSpace.data({ groupId })],
        },
        {
            key: 'about',
            name: 'Om',
            href: appHref(`/committees/${shortName}/about`),
            icon: faInfo,
            authorizers: () => [committeeAuth.readArticle],
        },
    ])
}
