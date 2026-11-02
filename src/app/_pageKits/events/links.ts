import { defineLinks } from '@/pageKits/defineLinks'
import { formatVevenUri } from '@/lib/urlEncoding'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { EventPagesConfig } from './config'

type EventRef = { name: string, id: number }

export type EventLinks = {
    /** The coming events, filtered to the tags named, or unfiltered given none. */
    list: (tagNames?: string[] | null) => string,
    archive: (tagNames?: string[] | null) => string,
    event: (event: EventRef) => string,
    attendance: (event: EventRef) => string,
}

const tagQuery = (tagNames?: string[] | null) => (tagNames?.length ? QueryParams.eventTags.encodeUrl(tagNames) : null)

export const eventLinks = defineLinks<EventPagesConfig, EventLinks>(href => ({
    list: tagNames => href('', tagQuery(tagNames)),
    archive: tagNames => href('/archive', tagQuery(tagNames)),
    event: event => href(`/${formatVevenUri(event.name, event.id)}`),
    attendance: event => href(`/${formatVevenUri(event.name, event.id)}/attendance`),
}))
