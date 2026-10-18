import styles from './UpcomingCompanyPresentations.module.scss'
import { contactorNavDef } from '@/app/(contactor)/_lib/contactorNavDef'
import Link from 'next/link'

/**
 * The strip under the hero that will show the next company presentations, as contactor.no's does.
 * A placeholder for now: the events are not read yet.
 */
export default function UpcomingCompanyPresentations() {
    return (
        <section aria-label="Kommende bedriftspresentasjoner" className={styles.strip}>
            <div className={styles.inner}>
                <span className={styles.label}>Kommende bedriftspresentasjoner</span>
                <span className={styles.placeholder}>Her kommer de neste bedriftspresentasjonene.</span>
                <Link href={contactorNavDef.companyPresentations.href} className={styles.all}>
                    Alle bedriftspresentasjoner →
                </Link>
            </div>
        </section>
    )
}
