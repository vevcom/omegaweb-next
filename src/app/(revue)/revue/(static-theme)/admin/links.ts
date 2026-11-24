import { revueAdminPages } from './config'
import { revueMailServerLinks } from '@/app/(revue)/revue/(static-theme)/admin/mail/links'
import { defineLinks } from '@/lib/sites/defineLinks'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

export type RevueAdminLinks = {
    frontpage: () => AppHref,
    mail: () => AppHref,
    revues: () => AppHref,
    revue: (revue: { year: number }) => AppHref,
    groups: () => AppHref,
    group: (group: { name: string }) => AppHref,
}

export const revueAdminLinks: RevueAdminLinks = defineLinks<PagesMount, RevueAdminLinks>(href => ({
    frontpage: () => href(),
    mail: () => revueMailServerLinks.frontpage(),
    revues: () => href('/revues'),
    revue: revue => href(`/revues/${revue.year}`),
    groups: () => href('/groups'),
    group: group => href(`/groups/${encodeURIComponent(group.name)}`),
}))(revueAdminPages)
