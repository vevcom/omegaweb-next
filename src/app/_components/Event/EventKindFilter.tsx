import { eventListLink } from '@/pageKits/events/links'
import { toggled } from '@/pageKits/events/filter'
import { showsSeveralKinds } from '@/pageKits/events/config'
import { eventKinds } from '@/services/events/kinds'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { EventListFilter } from '@/pageKits/events/links'

const choiceClassName = (picked: boolean) => `
    px-3 py-1 rounded-inner no-underline whitespace-nowrap
    ${picked ? 'bg-primary text-primary-content font-bold' : 'text-base-content hover:bg-base-300'}
`

/**
 * The kinds a list of events is narrowed to, where the pages show several. A kind links to the list
 * with it added or removed, and "Alle" to the list of every kind.
 */
export default function EventKindFilter({ config, filter, archive = false }: {
    config: EventPagesConfig,
    filter: EventListFilter,
    /** Whether the list is the archive rather than the coming events. */
    archive?: boolean,
}) {
    if (!showsSeveralKinds(config)) return null
    const listHref = eventListLink(config, archive)
    const pickedKinds = filter.kinds ?? []

    return <nav aria-label="Type arrangement" className="flex flex-wrap items-center gap-1">
        <SiteLink href={listHref({ ...filter, kinds: [] })} className={choiceClassName(pickedKinds.length === 0)}>
            Alle
        </SiteLink>
        {config.kindsToShow.map(kind => {
            const picked = pickedKinds.includes(kind)
            return <SiteLink
                key={kind}
                href={listHref({ ...filter, kinds: toggled(pickedKinds, kind) })}
                aria-current={picked ? 'true' : undefined}
                className={choiceClassName(picked)}
            >
                {eventKinds[kind].name}
            </SiteLink>
        })}
    </nav>
}
