import styles from './ContactorFooter.module.scss'
import ContactorWordmark from './ContactorWordmark'
import { CONTACTOR_EMAIL, CONTACTOR_SOCIALS } from './contactorSite'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFacebookSquare, faInstagram, faLinkedin } from '@fortawesome/free-brands-svg-icons'

export default function ContactorFooter() {
    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>
                <div className={styles.about}>
                    <ContactorWordmark light />
                    <p>
                        Bedriftskomité for Omega, NTNU. Vi knytter næringslivet sammen med studentene ved
                        kybernetikk og robotikk og elektronisk systemdesign og innovasjon.
                    </p>
                    <div className={styles.socials}>
                        <Link href={CONTACTOR_SOCIALS.facebook} target="_blank" aria-label="Contactor på Facebook">
                            <FontAwesomeIcon icon={faFacebookSquare} />
                        </Link>
                        <Link href={CONTACTOR_SOCIALS.linkedin} target="_blank" aria-label="Contactor på LinkedIn">
                            <FontAwesomeIcon icon={faLinkedin} />
                        </Link>
                        <Link href={CONTACTOR_SOCIALS.instagram} target="_blank" aria-label="Contactor på Instagram">
                            <FontAwesomeIcon icon={faInstagram} />
                        </Link>
                    </div>
                </div>
                <div>
                    <h3>Kontakt</h3>
                    <p><Link href={`mailto:${CONTACTOR_EMAIL}`}>{CONTACTOR_EMAIL}</Link></p>
                </div>
                <div>
                    <h3>Adresse</h3>
                    <p>Contactor NTNU</p>
                    <p>Høgskoleringen 1</p>
                    <p>7034 Trondheim</p>
                </div>
            </div>
            <div className={styles.bottom}>
                <div className={styles.inner}>
                    <span>© Contactor NTNU</span>
                    <Link href="/">Tilbake til omega.ntnu.no</Link>
                </div>
            </div>
        </footer>
    )
}
