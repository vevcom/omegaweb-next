import { defineLinks } from '@/lib/sites/defineLinks'
import type { SitePages } from '@/lib/sites/sites'

/** The revue site itself, which its own pages are relative to. */
export const revuePages: SitePages = { site: 'REVUE', path: '' }

export type RevueLinks = {
    frontpage: () => string,
}

export const revueLinks: RevueLinks = defineLinks<SitePages, RevueLinks>(href => ({
    frontpage: () => href(),
}))(revuePages)
