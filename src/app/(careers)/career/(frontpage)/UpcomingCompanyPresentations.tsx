import { bandClassName, innerClassName } from '@/app/(careers)/_lib/careersClassNames'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { AppHref } from '@/lib/sites/href'

type PropTypes = {
    /** The company presentations page. */
    eventsHref: AppHref,
}

/**
 * The strip under the hero that will show the next company presentations, as contactor.no's does.
 * A placeholder for now: the events are not read yet.
 */
export default function UpcomingCompanyPresentations({ eventsHref }: PropTypes) {
    return (
        <section
            aria-label="Kommende bedriftspresentasjoner"
            className={`
                ${bandClassName}
                border-y border-careers-line bg-base-200
            `}
        >
            <div className={`
                ${innerClassName}
                flex flex-wrap items-center gap-x-8 gap-y-2 py-5
            `}>
                <span className="text-careers-accent-dark text-s font-semibold tracking-[0.15em] uppercase">
                    Kommende bedriftspresentasjoner
                </span>
                <span className="flex-1 text-base-content/80 text-m">Her kommer de neste bedriftspresentasjonene.</span>
                <SiteLink href={eventsHref} className="text-careers-navy text-m font-semibold">
                    Alle bedriftspresentasjoner →
                </SiteLink>
            </div>
        </section>
    )
}
