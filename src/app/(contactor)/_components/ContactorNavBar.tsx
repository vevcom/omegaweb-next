import styles from './ContactorNavBar.module.scss'
import ContactorWordmark from './ContactorWordmark'
import { CAREER_PATH } from './contactorSite'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    links: { name: string, href: string }[],
}

/**
 * Contactor's navigation: the wordmark, the links, and the way back to Omega's site. The edit
 * mode switch is there for those who may edit the CMS content of the pages - it renders nothing
 * for everyone else.
 */
export default function ContactorNavBar({ links }: PropTypes) {
    return (
        <header className={styles.header}>
            <nav className={styles.nav}>
                <Link href={CAREER_PATH} className={styles.brand} aria-label="Contactor, til forsiden">
                    <ContactorWordmark />
                </Link>
                <ul className={styles.links}>
                    {links.map(link => (
                        <li key={link.href}>
                            <Link href={link.href}>{link.name}</Link>
                        </li>
                    ))}
                    <li className={styles.back}>
                        <Link href="/">
                            <FontAwesomeIcon icon={faArrowLeft} />
                            <span>Tilbake til Omegaveven</span>
                        </Link>
                    </li>
                </ul>
                <div className={styles.editMode}>
                    <EditModeSwitch />
                </div>
            </nav>
        </header>
    )
}
