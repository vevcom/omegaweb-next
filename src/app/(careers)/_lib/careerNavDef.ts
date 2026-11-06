import { careerLinks } from '@/app/(careers)/links'
import { careerJobAdLinks } from '@/app/(careers)/career/job-ads/links'
import { companyPresentationLinks } from '@/app/(careers)/career/company-presentations/links'
import { careerAdminLinks } from '@/app/(careers)/career/admin/links'
import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import { jobAdAuth } from '@/services/careers/jobAds/auth'
import { companyAuth } from '@/services/careers/companies/auth'
import { careersTeamAuth } from '@/services/careers/team/auth'
import { eventAuth } from '@/services/events/auth'
import { Require } from '@/auth/authorizer/Require'
import { defineNavDef } from '@/lib/navDef/navDef'
import {
    faBriefcase,
    faBuilding,
    faCalendar,
    faPeopleGroup,
    faTools,
    faUser,
} from '@fortawesome/free-solid-svg-icons'

/** The parts of the career pages, in the career site's navigation. */
export const careerNavDef = defineNavDef([
    {
        key: 'jobAds',
        name: 'Jobbannonser',
        href: careerJobAdLinks.list(),
        icon: faBriefcase,
        authorizers: () => [jobAdAuth.readActive],
    },
    {
        key: 'companyPresentations',
        name: 'Bedriftspresentasjoner',
        href: companyPresentationLinks.list(),
        icon: faCalendar,
        authorizers: () => [eventAuth.readManyCurrent],
    },
    {
        key: 'companies',
        name: 'Bedrifter',
        href: careerLinks.companies(),
        icon: faBuilding,
        authorizers: () => [companyAuth.readPage],
    },
    {
        key: 'about',
        name: 'Om oss',
        href: careerLinks.about(),
        icon: faPeopleGroup,
        authorizers: () => [careersTeamAuth.readDepartments],
    },
])

/** What belongs to the logged in user, which the navigation keeps apart from the pages of the site. */
export const careerAccountNavDef = defineNavDef([
    {
        key: 'profile',
        name: 'Min side',
        href: careerLinks.profile(),
        icon: faUser,
        authorizers: () => [Require.user()],
    },
    {
        key: 'admin',
        name: 'Administrasjon',
        href: careerAdminLinks.frontpage(),
        icon: faTools,
        authorizers: () => careerAdminNavDef.authorizers(),
    },
])
