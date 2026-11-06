//This file defines all the routes for the navbar and menu
//Higher placment in array gives hight priority on where it is placed (ie menu vs. navbar)
//does not include / or /login (or profile route) as they are always shown and ar special
import { adminNavDef } from '@/app/(omegaweb)/admin/adminNavDef'
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
import { defineNavDef } from '@/lib/navDef/navDef'
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

export const navDef = defineNavDef([
    {
        key: 'jobAds',
        name: 'Jobbannonser',
        href: omegaJobAdLinks.list(),
        icon: faBriefcase,
        authorizers: () => [jobAdAuth.readActive],
    },
    {
        key: 'events',
        name: 'Hvad der hender',
        href: omegaEventLinks.list(),
        icon: faCalendar,
        authorizers: () => [eventAuth.readManyCurrent],
    },
    {
        key: 'shops',
        name: 'Butikker',
        href: appHref('/shop'),
        icon: faShoppingCart,
        authorizers: () => [shopAuth.readMany],
    },
    {
        key: 'newStudent',
        name: 'Ny student?',
        href: appHref('/new-student'),
        icon: faGraduationCap,
        authorizers: () => [articleCategoryAuth.readAll],
        audience: 'loggedOut',
    },
    {
        key: 'omegaquotes',
        name: 'Omegaquotes',
        href: appHref('/omegaquotes'),
        icon: faComment,
        authorizers: () => [omegaQuotesAuth.readPage],
    },
    {
        key: 'news',
        name: 'Nyheter',
        href: appHref('/news'),
        icon: faNewspaper,
        authorizers: () => [newsAuth.readCurrent],
    },
    {
        key: 'articles',
        name: 'Artikler',
        href: appHref('/articles'),
        icon: faSignature,
        authorizers: () => [articleCategoryAuth.readAll],
    },
    {
        key: 'users',
        name: 'Broedre iitem Systre',
        href: appHref('/users'),
        icon: faPeopleLine,
        authorizers: () => [userAuth.readPage],
    },
    {
        key: 'committees',
        name: 'Komitéer',
        href: appHref('/committees'),
        icon: faBeer,
        authorizers: () => [committeeAuth.readAll],
    },
    {
        key: 'interestGroups',
        name: 'Interessegrupper',
        href: appHref('/interest-groups'),
        icon: faGamepad,
        authorizers: () => [interestGroupAuth.readMany],
    },
    {
        key: 'ombul',
        name: 'OmBul',
        href: appHref('/ombul'),
        icon: faBook,
        authorizers: () => [ombulAuth.readLatest],
    },
    {
        key: 'bulshit',
        name: 'Bulshit',
        href: appHref('/bulshit'),
        icon: faPoo,
        authorizers: () => [bulshitAuth.readPage, bulshitAuth.createOwn],
    },
    {
        key: 'cabin',
        name: 'Hyttebooking',
        href: appHref('/cabin'),
        icon: faHouseChimneyWindow,
        authorizers: () => [cabinArticleAuth.read],
    },
    {
        key: 'lockers',
        name: 'Skap',
        href: appHref('/lockers'),
        icon: faLock,
        authorizers: () => [lockerAuth.readPage],
    },
    {
        key: 'images',
        name: 'Bilder',
        href: appHref('/image-collections'),
        icon: faCamera,
        authorizers: () => [dynamicImageAuth.readCollectionPage.data({ onlyAdministrated: false })],
    },
    {
        key: 'applications',
        name: 'Søknadsperioder',
        href: appHref('/applications'),
        icon: faIdCard,
        authorizers: () => [applicationPeriodAuth.readAll],
    },
    {
        key: 'revue',
        name: 'Omegarevyen',
        href: revueLinks.frontpage(),
        icon: faMasksTheater,
        authorizers: () => [revueFrontpageAuth.readMainRevueInfo],
    },
    {
        key: 'career',
        name: 'Karriere',
        href: careerLinks.frontpage(), //purposly notredirectToMainDomain - keeping current domain
        icon: faSuitcase,
        authorizers: () => [careersFrontpageAuth.readSpecialCmsParagraph],
        audience: 'loggedIn',
    },
    {
        key: 'phinans',
        name: 'Phinans',
        href: externalHref('https://phinans.com/'),
        icon: faChartLine,
        // An external site, so nothing here decides who may open it.
        authorizers: () => [Require.nothing()],
    },
    {
        key: 'admin',
        name: 'Administrasjon',
        href: adminNavItemHref,
        icon: faTools,
        authorizers: () => adminNavDef.authorizers(),
    },
])
