import { userAuth } from '@/services/users/auth'
import { eventAuth } from '@/services/events/auth'
import { committeeAuth } from '@/services/groups/committees/auth'
import { interestGroupAuth } from '@/services/groups/interestGroups/auth'
import { newsAuth } from '@/services/news/auth'
import { companyAuth } from '@/services/careers/companies/auth'
import { jobAdAuth } from '@/services/careers/jobAds/auth'
import {
    faBriefcase,
    faBuilding,
    faCalendar,
    faNewspaper,
    faPeopleGroup,
    faUser,
    faUsers,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import type { CapabilityAuthorizer } from '@/auth/authorizer/capabilities'

export const searchCategoryNames = [
    'users',
    'events',
    'committees',
    'interestGroups',
    'news',
    'companies',
    'jobAds',
] as const

export type SearchCategory = typeof searchCategoryNames[number]

export const defaultSearchResultLimit = 5
export const singleCategorySearchResultLimit = 20

/**
 * What the global search shows for each category. `authorizer` is the category's own `search` rule,
 * which decides whether the session gets the category's tab at all.
 */
export const searchCategories: Record<SearchCategory, {
    label: string,
    icon: IconDefinition,
    authorizer: CapabilityAuthorizer,
}> = {
    users: { label: 'Brukere', icon: faUser, authorizer: userAuth.search },
    events: { label: 'Arrangementer', icon: faCalendar, authorizer: eventAuth.search },
    committees: { label: 'Komitéer', icon: faUsers, authorizer: committeeAuth.search },
    interestGroups: { label: 'Interessegrupper', icon: faPeopleGroup, authorizer: interestGroupAuth.search },
    news: { label: 'Nyheter', icon: faNewspaper, authorizer: newsAuth.search },
    companies: { label: 'Bedrifter', icon: faBuilding, authorizer: companyAuth.search },
    jobAds: { label: 'Jobbannonser', icon: faBriefcase, authorizer: jobAdAuth.search },
}
