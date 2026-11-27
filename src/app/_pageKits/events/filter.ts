import { eventKinds } from '@/services/events/kinds'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { EventPagesConfig } from './config'
import type { EventListFilter } from './links'
import type { EventKind } from '@/prisma-generated-pn-types'
import type { SearchParams } from '@/app/ServerPage'

/**
 * The kinds a list can be narrowed to: those the pages show that are marked by a tag. Pages showing
 * one kind have nothing to narrow.
 */
export function filterableKinds(config: EventPagesConfig): EventKind[] {
    if (config.kindsToShow.length < 2) return []
    return config.kindsToShow.filter(kind => eventKinds[kind].tag !== null)
}

/**
 * What the visitor has narrowed a list to, from the url. Pages without a tag filter are narrowed by
 * nothing but the search.
 */
export function eventListFilterOf(
    config: EventPagesConfig,
    searchParams: SearchParams,
): Required<EventListFilter> {
    const pickedKinds = QueryParams.eventKinds.decode(searchParams) ?? []
    return {
        tagNames: config.tagFilter ? QueryParams.eventTags.decode(searchParams) : null,
        kinds: config.tagFilter ? filterableKinds(config).filter(kind => pickedKinds.includes(kind)) : [],
        search: QueryParams.search.decode(searchParams) ?? '',
    }
}

/** The kinds a list reads: those picked, or every kind the pages show when none is. */
export function kindsToRead(config: EventPagesConfig, filter: EventListFilter): EventKind[] {
    return filter.kinds?.length ? filter.kinds : config.kindsToShow
}
