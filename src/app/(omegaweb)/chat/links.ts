import { chatPages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

export type ChatLinks = {
    messages: () => AppHref,
    directMessage: (user: { username: string }) => AppHref,
    spaces: () => AppHref,
    settings: () => AppHref,
    /** Where the chat's sign in sends the browser back, which is the one address it knows the chat pages by. */
    signIn: () => AppHref,
    /** Where the browser is signed out of the chat on its way out of the site, and sent on to `callbackUrl` after. */
    signOut: (callbackUrl: AppHref) => AppHref,
}

export const chatLinks: ChatLinks = defineLinks<PagesMount, ChatLinks>(href => ({
    messages: () => href(),
    directMessage: user => href(`/messages/${encodeURIComponent(user.username)}`),
    spaces: () => href('/spaces'),
    settings: () => href('/settings'),
    signIn: () => href('/sign-in'),
    signOut: callbackUrl => href('/sign-out', QueryParams.callbackUrl.encodeUrl(callbackUrl)),
}))(chatPages)
