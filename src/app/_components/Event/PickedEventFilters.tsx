import EventTag from './EventTag'
import { eventLinks } from '@/pageKits/events/links'
import { eventKinds } from '@/services/events/kinds'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { EventTagLook } from '@/services/events/kinds'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { EventListFilter } from '@/pageKits/events/links'

/** The kinds and tags a list of events is narrowed to. Each links to the list without it. */
export default function PickedEventFilters({ config, filter, eventTags, archive = false }: {
    config: EventPagesConfig,
    filter: EventListFilter,
    /** The tags to find the picked ones among. */
    eventTags: EventTagLook[],
    /** Whether the list is the archive rather than the coming events. */
    archive?: boolean,
}) {
    const links = eventLinks(config)
    const listHref = archive ? links.archive : links.list
    const pickedKinds = filter.kinds ?? []
    const pickedTagNames = filter.tagNames ?? []

    return <div className="
        flex items-center gap-[1em]
        [&_a]:no-underline [&_a]:relative
        [&_a:hover]:after:content-['✖'] [&_a:hover]:after:text-[4em] [&_a:hover]:after:text-base-content
        [&_a:hover]:after:absolute [&_a:hover]:after:left-1/2 [&_a:hover]:after:top-1/2 [&_a:hover]:after:-translate-1/2
    ">
        {pickedKinds.map(kind => {
            const tag = eventKinds[kind].tag
            return tag && <SiteLink
                key={kind}
                href={listHref({ ...filter, kinds: pickedKinds.filter(picked => picked !== kind) })}
            >
                <EventTag eventTag={tag} />
            </SiteLink>
        })}
        {eventTags.filter(tag => pickedTagNames.includes(tag.name)).map(tag => <SiteLink
            key={tag.name}
            href={listHref({ ...filter, tagNames: pickedTagNames.filter(name => name !== tag.name) })}
        >
            <EventTag eventTag={tag} />
        </SiteLink>)}
    </div>
}
