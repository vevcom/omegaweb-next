import styles from './HeaderItemLink.module.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    href: string,
    label: string,
    icon: IconDefinition,
}

/**
 * A header item that links to another page, styled to match the pill buttons from
 * HeaderItemPopUp (e.g. AddHeaderItemPopUp's "Ny" button).
 */
export default function HeaderItemLink({ href, label, icon }: PropTypes) {
    return (
        <Link href={href} className={styles.HeaderItemLink}>
            <span>{label}</span>
            <FontAwesomeIcon icon={icon} />
        </Link>
    )
}
