import type { SitePages } from '@/lib/sites'
import type { SpecialEventTags } from '@/prisma-generated-pn-types'

/**
 * How a site renders the event pages: the list of coming events at the config's path, its archive
 * at `${path}/archive`, the page of one event at `${path}/[nameAndId]` and its attendance page.
 * Omega's site lists every event; the career site lists the company presentations.
 */
export type EventPagesConfig = SitePages & {
    /** The titles of the list of coming events and of the archive. */
    titles: { current: string, archive: string },
    /**
     * A special tag the pages are fixed to: only events carrying it are listed and found, and there
     * is no tag filter. null lists every event, filtered by the tags the visitor picks.
     */
    lockedTag: SpecialEventTags | null,
}
