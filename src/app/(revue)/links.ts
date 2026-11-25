import { revuePages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

export type RevueLinks = {
    frontpage: () => AppHref,
    revue: (revue: { year: number }) => AppHref,
    revueGroup: (revue: { year: number }, group: { name: string }) => AppHref,
    user: (user: { username: string }) => AppHref,
}

export const revueLinks: RevueLinks = defineLinks<PagesMount, RevueLinks>(href => ({
    frontpage: () => href(),
    revue: revue => href(`/${revue.year}`),
    revueGroup: (revue, group) => href(`/${revue.year}/groups/${encodeURIComponent(group.name)}`),
    user: user => href(`/users/${user.username}`),
}))(revuePages)
