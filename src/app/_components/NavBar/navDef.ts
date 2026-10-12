//This file defines all the routes for the navbar and menu
//Higher placment in array gives hight priority on where it is placed (ie menu vs. navbar)
//does not include / or /login (or profile route) as they are always shown and ar special
import { adminNavAuthorizers } from '@/app/admin/adminNavDef'
import { committeeAuth } from '@/services/groups/committees/auth'
import { interestGroupAuth } from '@/services/groups/interestGroups/auth'
import { jobAdAuth } from '@/services/career/jobAds/auth'
import { careerAuth } from '@/services/career/auth'
import { articleCategoryAuth } from '@/services/articleCategories/auth'
import { eventAuth } from '@/services/events/auth'
import { ombulAuth } from '@/services/ombul/auth'
import { newsAuth } from '@/services/news/auth'
import { omegaQuotesAuth } from '@/services/omegaquotes/auth'
import { dynamicImageAuth } from '@/services/images/dynamic/auth'
import { cabinArticleAuth } from '@/services/cabin/article/auth'
import { userAuth } from '@/services/users/auth'
import { applicationPeriodAuth } from '@/services/applications/periods/auth'
import { bullshitAuth } from '@/services/bullshit/auth'
import { Require } from '@/auth/authorizer/Require'
import { adminNavItemHref } from '@/components/NavBar/adminNavItemHref'
import {
    faGamepad,
    faBook,
    faComment,
    faCamera,
    faNewspaper,
    faCalendar,
    faSuitcase,
    faBeer,
    faBriefcase,
    faGraduationCap,
    faTools,
    faSignature,
    faSchool,
    faHouseChimneyWindow,
    faPeopleLine,
    faIdCard,
    faPoo,
} from '@fortawesome/free-solid-svg-icons'
import type { Authorizer, UserRequiredOutOpt } from '@/auth/authorizer/Authorizer'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'

export type NavItem = {
    name: string,
    href: string,
    icon: IconDefinition,
    /**
     * The authorizers of the page the item points at, and passing **any** of them is enough to be
     * shown it - so a link is never offered to a page that would turn the viewer away. Filtering
     * authorizers are welcome: only whether they pass is looked at, not the filter they hand back.
     */
    authorizers: () => Authorizer<UserRequiredOutOpt, object | undefined>[],
    /**
     * Who the entry is worded for, not who may open it: some pages are offered under one name to
     * visitors and another to members. Left out, the entry is for everyone the authorizers let in.
     */
    audience?: 'loggedIn' | 'loggedOut',
}

/** What of an item the nav components render - the authorizers stay on the server. */
export type NavLink = Pick<NavItem, 'name' | 'href' | 'icon'>

export const navDef: NavItem[] = [
    {
        name: 'Komitéer',
        href: '/committees',
        icon: faBeer,
        authorizers: () => [committeeAuth.readAll],
    },
    {
        name: 'Jobbannonser',
        href: '/career/jobads',
        icon: faBriefcase,
        authorizers: () => [jobAdAuth.readActive],
    },
    {
        name: 'For bedrifter',
        href: '/career',
        icon: faSuitcase,
        authorizers: () => [careerAuth.readSpecialCmsParagraphCareerInfo],
        audience: 'loggedOut',
    },
    {
        name: 'Ny student?',
        href: '/articles',
        icon: faGraduationCap,
        authorizers: () => [articleCategoryAuth.readAll],
        audience: 'loggedOut',
    },
    {
        name: 'Hvad der hender',
        href: '/events',
        icon: faCalendar,
        authorizers: () => [eventAuth.readManyCurrent],
    },
    {
        name: 'OmBul',
        href: '/ombul',
        icon: faBook,
        authorizers: () => [ombulAuth.readLatest],
    },
    {
        name: 'Karriere',
        href: '/career',
        icon: faSuitcase,
        authorizers: () => [careerAuth.readSpecialCmsParagraphCareerInfo],
        audience: 'loggedIn',
    },
    {
        name: 'Nyheter',
        href: '/news',
        icon: faNewspaper,
        authorizers: () => [newsAuth.readCurrent],
    },
    {
        name: 'Omegaquotes',
        href: '/omegaquotes',
        icon: faComment,
        authorizers: () => [omegaQuotesAuth.readPage],
    },
    {
        name: 'Bullshit',
        href: '/bullshit',
        icon: faPoo,
        authorizers: () => [bullshitAuth.readPage, bullshitAuth.create],
    },
    {
        name: 'Artikler',
        href: '/articles',
        icon: faSignature,
        authorizers: () => [articleCategoryAuth.readAll],
    },
    {
        // A page of static content with no service behind it.
        name: 'Fagveven',
        href: '/education',
        icon: faSchool,
        authorizers: () => [Require.nothing()],
    },
    {
        name: 'Bilder',
        href: '/image-collections',
        icon: faCamera,
        authorizers: () => [dynamicImageAuth.readCollectionPage],
    },
    {
        name: 'Interessegrupper',
        href: '/interest-groups',
        icon: faGamepad,
        authorizers: () => [interestGroupAuth.readMany],
    },
    {
        name: 'Hyttebooking',
        href: '/cabin',
        icon: faHouseChimneyWindow,
        authorizers: () => [cabinArticleAuth.read],
    },
    {
        name: 'Broedre iitem Systre',
        href: '/users',
        icon: faPeopleLine,
        authorizers: () => [userAuth.readPage],
    },
    {
        name: 'Søknadsperioder',
        href: '/applications',
        icon: faIdCard,
        authorizers: () => [applicationPeriodAuth.readAll],
    },
    {
        name: 'Administrasjon',
        href: adminNavItemHref,
        icon: faTools,
        authorizers: () => adminNavAuthorizers(),
    },
]

/**
 * The items of the nav the session may open and is the audience of, in order.
 */
export function visibleNavItems(session: SessionMaybeUser): NavLink[] {
    const loggedIn = session.user !== null
    return navDef
        .filter(item => item.audience === undefined || (item.audience === 'loggedIn') === loggedIn)
        .filter(item => item.authorizers().some(authorizer => authorizer.auth(session).authorized))
        .map(({ name, href, icon }) => ({ name, href, icon }))
}
