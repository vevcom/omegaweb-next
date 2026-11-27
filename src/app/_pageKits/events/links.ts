import { eventHomePages } from './homePages'
import { defineLinks } from '@/lib/sites/defineLinks'
import { formatVevenUri } from '@/lib/urlEncoding'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AppHref } from '@/lib/sites/href'
import type { EventPagesConfig } from './config'
import type { EventKind } from '@/prisma-generated-pn-types'

type EventRef = { name: string, id: number, kind: EventKind }

/** What a list of events is narrowed to. Left out, a part narrows nothing. */
export type EventListFilter = { tagNames?: string[] | null, kinds?: EventKind[], search?: string }

export type EventLinks = {
    /** The coming events, narrowed to the filter, or all of them given none. */
    list: (filter?: EventListFilter) => AppHref,
    archive: (filter?: EventListFilter) => AppHref,
    /** The page of the event: under these pages when they show its kind, and on the home pages of its kind otherwise. */
    event: (event: EventRef) => AppHref,
    attendance: (event: EventRef) => AppHref,
}

const listQuery = ({ tagNames, kinds, search }: EventListFilter = {}) => [
    tagNames?.length ? QueryParams.eventTags.encodeUrl(tagNames) : null,
    kinds?.length ? QueryParams.eventKinds.encodeUrl(kinds) : null,
    search ? QueryParams.search.encodeUrl(search) : null,
].filter(param => param !== null).join('&')

const eventPath = (event: EventRef) => `/${formatVevenUri(event.name, event.id)}`

export const eventLinks = defineLinks<EventPagesConfig, EventLinks>((href, config): EventLinks => {
    const shows = (event: EventRef) => config.kindsToShow.includes(event.kind)
    const home = (event: EventRef) => eventLinks(eventHomePages[event.kind])
    return {
        list: filter => href('', listQuery(filter)),
        archive: filter => href('/archive', listQuery(filter)),
        event: event => (shows(event) ? href(eventPath(event)) : home(event).event(event)),
        attendance: event => (shows(event) ? href(`${eventPath(event)}/attendance`) : home(event).attendance(event)),
    }
})

/** The links of the home pages of the event's kind, for what is rendered on no pages, as a notification is. */
export const eventHomeLinks = (event: EventRef) => eventLinks(eventHomePages[event.kind])
