import { bandClassName, innerClassName } from '@/app/(contactor)/_lib/contactorClassNames'
import Link from 'next/link'

type PropTypes = {
    /** The events page filtered to the company presentations. */
    eventsHref: string,
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
                border-y border-contactor-line bg-surface-raised
            `}
        >
            <div className={`
                ${innerClassName}
                flex flex-wrap items-center gap-x-8 gap-y-2 py-5
            `}>
                <span className="text-contactor-accent-dark text-s font-semibold tracking-[0.15em] uppercase">
                    Kommende bedriftspresentasjoner
                </span>
                <span className="flex-1 text-text-muted text-m">Her kommer de neste bedriftspresentasjonene.</span>
                <Link href={eventsHref} className="text-contactor-navy text-m font-semibold">Alle arrangementer →</Link>
            </div>
        </section>
    )
}
