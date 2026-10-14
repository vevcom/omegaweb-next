import styles from './UpcomingCompanyPresentations.module.scss'
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
        <section aria-label="Kommende bedriftspresentasjoner" className={styles.strip}>
            <div className={styles.inner}>
                <span className={styles.label}>Kommende bedriftspresentasjoner</span>
                <span className={styles.placeholder}>Her kommer de neste bedriftspresentasjonene.</span>
                <Link href={eventsHref} className={styles.all}>Alle arrangementer →</Link>
            </div>
        </section>
    )
}
