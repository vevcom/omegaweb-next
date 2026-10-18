import styles from './ContactorFooter.module.scss'
import ContactorWordmark from './ContactorWordmark'
import { CONTACTOR_SOCIALS } from '@/app/(contactor)/_lib/contactorContact'
import SpecialCmsLink from '@/components/Cms/CmsLink/SpecialCmsLink'
import { readCareerSpecialCmsLinkAction, updateCareerSpecialCmsLinkAction } from '@/services/career/actions'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFacebookSquare, faInstagram, faLinkedin } from '@fortawesome/free-brands-svg-icons'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = {
    capabilities: Capabilities<'canEditSpecialCmsLink'>,
}

export default function ContactorFooter({ capabilities }: PropTypes) {
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
                    <SpecialCmsLink
                        special="CAREER_CONTACT"
                        className={styles.contactLink}
                        capabilities={{ canEdit: capabilities.canEditSpecialCmsLink }}
                        readSpecialCmsLinkAction={readCareerSpecialCmsLinkAction}
                        updateCmsLinkAction={updateCareerSpecialCmsLinkAction}
                    />
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
                    <Link href="/">Tilbake til Omegaveven</Link>
                </div>
            </div>
        </footer>
    )
}
