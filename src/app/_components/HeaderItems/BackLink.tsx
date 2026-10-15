import styles from './BackLink.module.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'

type PropTypes = {
    href: string,
    /** What is gone back to, e.g. the name of the event a sub page belongs to. */
    label: string,
}

/**
 * A header item link back to the page this one sits under, styled to match the pill buttons from
 * HeaderItemPopUp and ArchiveLink - with the arrow leading, since that is the way it goes.
 */
export default function BackLink({ href, label }: PropTypes) {
    return (
        <Link href={href} className={styles.BackLink}>
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>{label}</span>
        </Link>
    )
}
