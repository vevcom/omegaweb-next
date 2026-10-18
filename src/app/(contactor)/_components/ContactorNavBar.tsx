import styles from './ContactorNavBar.module.scss'
import ContactorWordmark from './ContactorWordmark'
import { CAREER_PATH, contactorNavDef } from '@/app/(contactor)/_lib/contactorNavDef'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'


export default function ContactorNavBar() {
    return (
        <header className={styles.header}>
            <nav className={styles.nav}>
                <Link href={CAREER_PATH} className={styles.brand} aria-label="Contactor, til forsiden">
                    <ContactorWordmark />
                </Link>
                <ul className={styles.links}>
                    {Object.values(contactorNavDef).map(link => (
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
