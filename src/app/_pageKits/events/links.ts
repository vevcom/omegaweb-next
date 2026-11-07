import { defineLinks } from '@/lib/sites/defineLinks'
import { formatVevenUri } from '@/lib/urlEncoding'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AppHref } from '@/lib/sites/href'
import type { EventPagesConfig } from './config'

type EventRef = { name: string, id: number }

export type EventLinks = {
    /** The coming events, filtered to the tags named and the search text, or unfiltered given neither. */
    list: (tagNames?: string[] | null, search?: string) => AppHref,
    archive: (tagNames?: string[] | null, search?: string) => AppHref,
    event: (event: EventRef) => AppHref,
    attendance: (event: EventRef) => AppHref,
}

const listQuery = (tagNames?: string[] | null, search?: string) => [
    tagNames?.length ? QueryParams.eventTags.encodeUrl(tagNames) : null,
    search ? QueryParams.search.encodeUrl(search) : null,
].filter(param => param !== null).join('&')

export const eventLinks = defineLinks<EventPagesConfig, EventLinks>(href => ({
    list: (tagNames, search) => href('', listQuery(tagNames, search)),
    archive: (tagNames, search) => href('/archive', listQuery(tagNames, search)),
    event: event => href(`/${formatVevenUri(event.name, event.id)}`),
    attendance: event => href(`/${formatVevenUri(event.name, event.id)}/attendance`),
}))
