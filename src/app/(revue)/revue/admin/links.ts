import { revueAdminPages } from './config'
import { revueMailServerLinks } from '@/app/(revue)/revue/admin/mail/links'
import { defineLinks } from '@/lib/sites/defineLinks'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

export type RevueAdminLinks = {
    frontpage: () => AppHref,
    mail: () => AppHref,
}

export const revueAdminLinks: RevueAdminLinks = defineLinks<PagesMount, RevueAdminLinks>(href => ({
    frontpage: () => href(),
    mail: () => revueMailServerLinks.frontpage(),
}))(revueAdminPages)
