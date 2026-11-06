//This file defines all the routes for the navbar and menu
//Higher placment in array gives hight priority on where it is placed (ie menu vs. navbar)
//does not include / or /login (or profile route) as they are always shown and ar special
import { adminNavAuthorizers } from '@/app/(omegaweb)/admin/adminNavDef'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { omegaJobAdLinks } from '@/app/(omegaweb)/job-ads/links'
import { revueLinks } from '@/app/(revue)/links'
import { careerLinks } from '@/app/(careers)/links'
import { committeeAuth } from '@/services/groups/committees/auth'
import { interestGroupAuth } from '@/services/groups/interestGroups/auth'
import { jobAdAuth } from '@/services/careers/jobAds/auth'
import { careersFrontpageAuth } from '@/services/careers/frontpage/auth'
import { articleCategoryAuth } from '@/services/articleCategories/auth'
import { eventAuth } from '@/services/events/auth'
import { ombulAuth } from '@/services/ombul/auth'
import { newsAuth } from '@/services/news/auth'
import { omegaQuotesAuth } from '@/services/omegaquotes/auth'
import { dynamicImageAuth } from '@/services/images/dynamic/auth'
import { cabinArticleAuth } from '@/services/cabin/article/auth'
import { revueFrontpageAuth } from '@/services/revue/frontpage/auth'
import { userAuth } from '@/services/users/auth'
import { applicationPeriodAuth } from '@/services/applications/periods/auth'
import { bulshitAuth } from '@/services/bulshit/auth'
import { lockerAuth } from '@/services/lockers/auth'
import { shopAuth } from '@/services/shop/shop/auth'
import { adminNavItemHref } from '@/components/NavBar/adminNavItemHref'
import { Require } from '@/auth/authorizer/Require'
import { appHref } from '@/lib/sites/href'
import { externalHref } from '@/lib/sites/href'
import {
    faGamepad,
    faBook,
    faComment,
    faCamera,
    faNewspaper,
    faCalendar,
    faBeer,
    faBriefcase,
    faSuitcase,
    faGraduationCap,
    faTools,
    faSignature,
    faHouseChimneyWindow,
    faPeopleLine,
    faIdCard,
    faPoo,
    faShoppingCart,
    faLock,
    faChartLine,
    faMasksTheater,
} from '@fortawesome/free-solid-svg-icons'
import type { AppHref } from '@/lib/sites/href'
import type { Authorizer, UserRequiredOutOpt } from '@/auth/authorizer/Authorizer'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import type { ExternalHref } from '@/lib/sites/href'

export type NavItem = {
    name: string,
    href: AppHref | ExternalHref,
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
        name: 'Jobbannonser',
        href: omegaJobAdLinks.list(),
        icon: faBriefcase,
        authorizers: () => [jobAdAuth.readActive],
    },
    {
        name: 'Hvad der hender',
        href: omegaEventLinks.list(),
        icon: faCalendar,
        authorizers: () => [eventAuth.readManyCurrent],
    },
    {
        name: 'Butikker',
        href: appHref('/shop'),
        icon: faShoppingCart,
        authorizers: () => [shopAuth.readMany],
    },
    {
        name: 'Ny student?',
        href: appHref('/new-student'),
        icon: faGraduationCap,
        authorizers: () => [articleCategoryAuth.readAll],
        audience: 'loggedOut',
    },
    {
        name: 'Omegaquotes',
        href: appHref('/omegaquotes'),
        icon: faComment,
        authorizers: () => [omegaQuotesAuth.readPage],
    },
    {
        name: 'Nyheter',
        href: appHref('/news'),
        icon: faNewspaper,
        authorizers: () => [newsAuth.readCurrent],
    },
    {
        name: 'Artikler',
        href: appHref('/articles'),
        icon: faSignature,
        authorizers: () => [articleCategoryAuth.readAll],
    },
    {
        name: 'Broedre iitem Systre',
        href: appHref('/users'),
        icon: faPeopleLine,
        authorizers: () => [userAuth.readPage],
    },
    {
        name: 'Komitéer',
        href: appHref('/committees'),
        icon: faBeer,
        authorizers: () => [committeeAuth.readAll],
    },
    {
        name: 'Interessegrupper',
        href: appHref('/interest-groups'),
        icon: faGamepad,
        authorizers: () => [interestGroupAuth.readMany],
    },
    {
        name: 'OmBul',
        href: appHref('/ombul'),
        icon: faBook,
        authorizers: () => [ombulAuth.readLatest],
    },
    {
        name: 'Bulshit',
        href: appHref('/bulshit'),
        icon: faPoo,
        authorizers: () => [bulshitAuth.readPage, bulshitAuth.createOwn],
    },
    {
        name: 'Hyttebooking',
        href: appHref('/cabin'),
        icon: faHouseChimneyWindow,
        authorizers: () => [cabinArticleAuth.read],
    },
    {
        name: 'Skap',
        href: appHref('/lockers'),
        icon: faLock,
        authorizers: () => [lockerAuth.readPage],
    },
    {
        name: 'Bilder',
        href: appHref('/image-collections'),
        icon: faCamera,
        authorizers: () => [dynamicImageAuth.readCollectionPage.data({ onlyAdministrated: false })],
    },
    {
        name: 'Søknadsperioder',
        href: appHref('/applications'),
        icon: faIdCard,
        authorizers: () => [applicationPeriodAuth.readAll],
    },
    {
        name: 'Omegarevyen',
        href: revueLinks.frontpage(),
        icon: faMasksTheater,
        authorizers: () => [revueFrontpageAuth.readMainRevueInfo],
    },
    {
        name: 'Karriere',
        href: careerLinks.frontpage(), //purposly notredirectToMainDomain - keeping current domain
        icon: faSuitcase,
        authorizers: () => [careersFrontpageAuth.readSpecialCmsParagraph],
        audience: 'loggedIn',
    },
    {
        name: 'Phinans',
        href: externalHref('https://phinans.com/'),
        icon: faChartLine,
        // An external site, so nothing here decides who may open it.
        authorizers: () => [Require.nothing()],
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
