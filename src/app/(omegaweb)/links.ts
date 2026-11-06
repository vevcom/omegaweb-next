import { omegaPages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import { formatVevenUri } from '@/lib/urlEncoding'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

/** The pages of Omega's site that the kits, the other sites and the services link to. */
export type OmegaLinks = {
    frontpage: () => AppHref,
    committee: (committee: { shortName: string }) => AppHref,
    interestGroup: (interestGroup: { id: number }) => AppHref,
    user: (user: { username: string }) => AppHref,
    userNotifications: (user: { username: string }) => AppHref,
    news: (news: { articleName: string, id: number }) => AppHref,
    ombul: (ombul: { year: number, name: string, id: number }) => AppHref,
    omegaquotes: () => AppHref,
}

export const omegaLinks: OmegaLinks = defineLinks<PagesMount, OmegaLinks>(href => ({
    frontpage: () => href(),
    committee: committee => href(`/committees/${committee.shortName}`),
    interestGroup: interestGroup => href(`/interest-groups/${interestGroup.id}`),
    user: user => href(`/users/${user.username}`),
    userNotifications: user => href(`/users/${user.username}/notifications`),
    news: news => href(`/news/${formatVevenUri(news.articleName, news.id)}`),
    ombul: ombul => href(`/ombul/${ombul.year}/${formatVevenUri(ombul.name, ombul.id)}`),
    omegaquotes: () => href('/omegaquotes'),
}))(omegaPages)
