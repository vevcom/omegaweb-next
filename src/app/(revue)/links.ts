import { revuePages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

export type RevueLinks = {
    frontpage: () => AppHref,
}

export const revueLinks: RevueLinks = defineLinks<PagesMount, RevueLinks>(href => ({
    frontpage: () => href(),
}))(revuePages)
