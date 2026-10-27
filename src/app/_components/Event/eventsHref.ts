import { QueryParams } from '@/lib/queryParams/queryParams'

/** A link to the event list or archive with these tags selected, keeping the search. */
export function eventsHref(page: 'EVENT' | 'EVENT_ARCHIVE', { tags, search }: {
    tags: string[] | null,
    search: string,
}) {
    const base = page === 'EVENT' ? '/events' : '/events/archive'
    const params = [
        tags?.length ? QueryParams.eventTags.encodeUrl(tags) : null,
        search ? QueryParams.search.encodeUrl(search) : null,
    ].filter(param => param !== null)
    return params.length ? `${base}?${params.join('&')}` : base
}
