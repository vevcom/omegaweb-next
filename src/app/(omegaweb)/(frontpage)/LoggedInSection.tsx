import styles from './LoggedInSection.module.scss'
import React from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInbox } from '@fortawesome/free-solid-svg-icons'

export default function LoggedInSection({
    title,
    link,
    layout = 'grid',
    span = 'full',
    emptyMessage = 'Ingenting å vise her enda',
    children,
}: {
    title: string,
    link: string,
    /** 'rows' stacks full-width children instead of laying them out as a card grid. */
    layout?: 'grid' | 'rows',
    /** How much of the island row this section claims once there is room for two. */
    span?: 'full' | 'half',
    /** Shown in place of the list when there are no children to display. */
    emptyMessage?: string,
    children: React.ReactNode,
}) {
    const isEmpty = React.Children.count(children) === 0

    return <section className={`${styles.LoggedInSection} ${span === 'half' ? styles.half : ''}`}>
        <div className={styles.title}>
            <h4>{title}</h4>
            <Link href={link} className={styles.readMore}>Se flere</Link>
        </div>
        <div className={`${styles.content} ${layout === 'rows' ? styles.rows : ''}`}>
            {isEmpty
                ? <div className={styles.empty}>
                    <FontAwesomeIcon icon={faInbox} />
                    <p>{emptyMessage}</p>
                </div>
                : children}
        </div>
    </section>
}
