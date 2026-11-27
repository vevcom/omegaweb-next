import type { PagesMount } from '@/lib/sites/defineLinks'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { EventKind } from '@/prisma-generated-pn-types'

/**
 * How a site renders the event pages: the list of coming events at the mount path, its archive
 * at `${mountPath}/archive`, the page of one event at `${mountPath}/[nameAndId]` and its attendance page.
 * Omega's site lists the events of every kind, and the career site has one mount for each of its kinds.
 */
export type EventPagesConfig = PagesMount & {
    /** The titles of the list of coming events and of the archive. */
    titles: { current: string, archive: string },
    /** The kinds of event the pages list and find. An event of another kind is not found under them. */
    kindsToShow: EventKind[],
    /** The kind picked to begin with when an event is created from these pages. */
    defaultKind: EventKind,
    /** Whether the lists are filtered by the tags the visitor picks. */
    tagFilter: boolean,
    /** The sign in flow of the site, for the login link where an event takes registrations. */
    authPages: AuthPagesConfig,
}

/** Whether the pages show several kinds, so that each event says its kind and a list is narrowed to kinds. */
export function showsSeveralKinds(config: EventPagesConfig): boolean {
    return config.kindsToShow.length > 1
}
