import { chatPages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

export type ChatLinks = {
    messages: () => AppHref,
    spaces: () => AppHref,
    settings: () => AppHref,
}

export const chatLinks: ChatLinks = defineLinks<PagesMount, ChatLinks>(href => ({
    messages: () => href(),
    spaces: () => href('/spaces'),
    settings: () => href('/settings'),
}))(chatPages)
