import styles from './ContactorPageHeader.module.scss'
import type { ReactNode } from 'react'

type PropTypes = {
    /** The small label above the title, naming the part of the site the page belongs to. */
    badge: string,
    title: string,
    lead?: string,
    /** Links or controls under the lead, such as the way to an archive. */
    children?: ReactNode,
}

/**
 * The head of a page on Contactor's site, in place of Omega's PageWrapper: a full-width band with
 * the page's title, the way contactor.no's pages open. What comes under it is the shared
 * components, which take Contactor's look from the theme.
 */
export default function ContactorPageHeader({ badge, title, lead, children }: PropTypes) {
    return (
        <header className={styles.ContactorPageHeader}>
            <div className={styles.inner}>
                <span className={styles.badge}>{badge}</span>
                <h1>{title}</h1>
                {lead && <p className={styles.lead}>{lead}</p>}
                {children && <div className={styles.actions}>{children}</div>}
            </div>
        </header>
    )
}
