import { defineLinks } from '@/pageKits/defineLinks'
import { formatVevenUri } from '@/lib/urlEncoding'
import type { SitePages } from '@/lib/sites'

/** Omega's site itself, which its own pages are relative to. */
export const omegaPages: SitePages = { site: 'OMEGAWEB', path: '' }

/** The pages of Omega's site that the kits, the other sites and the services link to. */
export type OmegaLinks = {
    frontpage: () => string,
    committee: (committee: { shortName: string }) => string,
    user: (user: { username: string }) => string,
    userNotifications: (user: { username: string }) => string,
    news: (news: { articleName: string, id: number }) => string,
    ombul: (ombul: { year: number, name: string, id: number }) => string,
    omegaquotes: () => string,
}

export const omegaLinks: OmegaLinks = defineLinks<SitePages, OmegaLinks>(href => ({
    frontpage: () => href(),
    committee: committee => href(`/committees/${committee.shortName}`),
    user: user => href(`/users/${user.username}`),
    userNotifications: user => href(`/users/${user.username}/notifications`),
    news: news => href(`/news/${formatVevenUri(news.articleName, news.id)}`),
    ombul: ombul => href(`/ombul/${ombul.year}/${formatVevenUri(ombul.name, ombul.id)}`),
    omegaquotes: () => href('/omegaquotes'),
}))(omegaPages)
