import { revuePages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import type { SitePages } from '@/lib/sites/defineLinks'

export type RevueLinks = {
    frontpage: () => string,
}

export const revueLinks: RevueLinks = defineLinks<SitePages, RevueLinks>(href => ({
    frontpage: () => href(),
}))(revuePages)
