import '@pn-server-only'
import { userOperations } from '@/services/users/operations'
import { eventOperations } from '@/services/events/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { interestGroupOperations } from '@/services/groups/interestGroups/operations'
import { newsOperations } from '@/services/news/operations'
import { companyOperations } from '@/services/careers/companies/operations'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { formatVevenUri } from '@/lib/urlEncoding'
import { displayDate } from '@/lib/dates/displayDate'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { SearchCategory } from './constants'
import type { SearchResult } from './types'

type SearchProvider = (params: { query: string, limit: number }) => Promise<SearchResult[]>

/**
 * How each category is searched. A provider only calls its service's own `search` operation and
 * turns the rows into results, so whether the session may search the category is decided there.
 */
export const searchProviders: Record<SearchCategory, SearchProvider> = {
    users: async params => (await userOperations.search({ params })).map(user => ({
        key: `user-${user.id}`,
        href: `/users/${user.username}`,
        label: `${user.firstname} ${user.lastname}`,
        sublabel: `@${user.username}`,
        image: user.image,
    })),
    events: async params => (await eventOperations.search({ params })).map(event => ({
        key: `event-${event.id}`,
        href: `/events/${formatVevenUri(event.name, event.id)}`,
        label: event.name,
        sublabel: displayDate(event.eventStart, false),
        image: event.coverImage.image,
    })),
    committees: async params => (await committeeOperations.search({ params })).map(committee => ({
        key: `committee-${committee.id}`,
        href: `/committees/${committee.shortName}`,
        label: committee.name,
        sublabel: committee.group.pensioned ? 'Pensjonert' : undefined,
        image: committee.logoImage,
    })),
    interestGroups: async params => (await interestGroupOperations.search({ params })).map(interestGroup => ({
        key: `interest-group-${interestGroup.id}`,
        href: `/interest-groups/${interestGroup.id}`,
        label: interestGroup.name,
        sublabel: interestGroup.group.pensioned ? 'Pensjonert' : undefined,
        image: null,
    })),
    news: async params => (await newsOperations.search({ params })).map(news => ({
        key: `news-${news.id}`,
        href: `/news/${formatVevenUri(news.article.name, news.id)}`,
        label: news.article.name,
        sublabel: news.published ? undefined : 'Utkast',
        image: news.coverImage,
    })),
    // A company has no page of its own, so the result opens the company list filtered to it.
    companies: async params => (await companyOperations.search({ params })).map(company => ({
        key: `company-${company.id}`,
        href: `/career/companies?${QueryParams.companyName.encodeUrl(company.name)}`,
        label: company.name,
        image: company.logo.image,
    })),
    jobAds: async params => (await jobAdOperations.search({ params })).map(jobAd => ({
        key: `job-ad-${jobAd.id}`,
        href: `/job-ads/${formatVevenUri(jobAd.article.name, jobAd.id)}`,
        label: jobAd.article.name,
        sublabel: jobAd.active ? jobAd.company.name : `${jobAd.company.name} (utløpt)`,
        image: null,
    })),
}
