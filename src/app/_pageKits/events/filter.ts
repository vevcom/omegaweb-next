import { QueryParams } from '@/lib/queryParams/queryParams'
import type { EventPagesConfig } from './config'
import type { EventListFilter } from './links'
import type { EventKind } from '@/prisma-generated-pn-types'
import type { SearchParams } from '@/app/ServerPage'

/** Whether the pages show several kinds, so that each event says its kind and a list is narrowed to kinds. */
export function showsSeveralKinds(config: EventPagesConfig): boolean {
    return config.kindsToShow.length > 1
}

/**
 * What the visitor has narrowed a list to, from the url: tags where the pages take a tag filter, and
 * kinds where they show several.
 */
export function eventListFilterOf(
    config: EventPagesConfig,
    searchParams: SearchParams,
): Required<EventListFilter> {
    const pickedKinds = QueryParams.eventKinds.decode(searchParams) ?? []
    return {
        tagNames: config.tagFilter ? QueryParams.eventTags.decode(searchParams) : null,
        kinds: showsSeveralKinds(config) ? config.kindsToShow.filter(kind => pickedKinds.includes(kind)) : [],
        search: QueryParams.search.decode(searchParams) ?? '',
    }
}

/** The kinds a list reads: those picked, or every kind the pages show when none is. */
export function kindsToRead(config: EventPagesConfig, filter: EventListFilter): EventKind[] {
    return filter.kinds?.length ? filter.kinds : config.kindsToShow
}
