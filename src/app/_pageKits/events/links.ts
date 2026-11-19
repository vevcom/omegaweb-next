import { defineLinks } from '@/lib/sites/defineLinks'
import { formatVevenUri } from '@/lib/urlEncoding'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AppHref } from '@/lib/sites/href'
import type { EventPagesConfig } from './config'
import type { EventKind } from '@/prisma-generated-pn-types'

type EventRef = { name: string, id: number }

/** What a list of events is narrowed to. Left out, a part narrows nothing. */
export type EventListFilter = { tagNames?: string[] | null, kinds?: EventKind[], search?: string }

export type EventLinks = {
    /** The coming events, narrowed to the filter, or all of them given none. */
    list: (filter?: EventListFilter) => AppHref,
    archive: (filter?: EventListFilter) => AppHref,
    event: (event: EventRef) => AppHref,
    attendance: (event: EventRef) => AppHref,
}

const listQuery = ({ tagNames, kinds, search }: EventListFilter = {}) => [
    tagNames?.length ? QueryParams.eventTags.encodeUrl(tagNames) : null,
    kinds?.length ? QueryParams.eventKinds.encodeUrl(kinds) : null,
    search ? QueryParams.search.encodeUrl(search) : null,
].filter(param => param !== null).join('&')

export const eventLinks = defineLinks<EventPagesConfig, EventLinks>(href => ({
    list: filter => href('', listQuery(filter)),
    archive: filter => href('/archive', listQuery(filter)),
    event: event => href(`/${formatVevenUri(event.name, event.id)}`),
    attendance: event => href(`/${formatVevenUri(event.name, event.id)}/attendance`),
}))
