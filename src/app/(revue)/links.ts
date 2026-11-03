import { revuePages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import type { PagesMount } from '@/lib/sites/defineLinks'

export type RevueLinks = {
    frontpage: () => string,
}

export const revueLinks: RevueLinks = defineLinks<PagesMount, RevueLinks>(href => ({
    frontpage: () => href(),
}))(revuePages)
