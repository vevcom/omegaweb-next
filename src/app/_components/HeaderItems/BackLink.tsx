import styles from './BackLink.module.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'

type PropTypes = {
    href: string,
    label: string,
}

export default function BackLink({ href, label }: PropTypes) {
    return (
        <Link href={href} className={styles.BackLink}>
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>{label}</span>
        </Link>
    )
}
