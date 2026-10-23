import CareersWordmark from './CareersWordmark'
import { CAREERS_SOCIALS } from '@/app/(careers)/_lib/careersSite'
import { cmsLinkTextClassName, innerClassName } from '@/app/(careers)/_lib/careersClassNames'
import SpecialCmsLink from '@/components/Cms/CmsLink/SpecialCmsLink'
import { readCareerSpecialCmsLinkAction, updateCareerSpecialCmsLinkAction } from '@/services/career/actions'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFacebookSquare, faInstagram, faLinkedin } from '@fortawesome/free-brands-svg-icons'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = {
    capabilities: Capabilities<'canEditSpecialCmsLink'>,
}

const headingClassName = 'mb-2 text-s font-semibold tracking-[0.1em] uppercase text-white'
const textClassName = 'text-white/80 text-m leading-[1.6]'

export default function CareersFooter({ capabilities }: PropTypes) {
    return (
        <footer className="mt-20 bg-careers-navy">
            <div className={`
                ${innerClassName}
                py-16 grid grid-cols-[2fr_1fr_1fr] gap-10
                max-mobile:grid-cols-1
            `}>
                <div>
                    <CareersWordmark light />
                    <p className={`
                        ${textClassName}
                        max-w-[45ch] mt-4
                    `}>
                        Bedriftskomité for Omega, NTNU. Vi knytter næringslivet sammen med studentene ved
                        kybernetikk og robotikk og elektronisk systemdesign og innovasjon.
                    </p>
                    <div className="
                        flex gap-4 mt-6
                        [&_a]:text-[1.5em] [&_a]:text-white/80
                        [&_a:hover]:text-white
                        [&_svg]:text-inherit
                    ">
                        <Link href={CAREERS_SOCIALS.facebook} target="_blank" aria-label="Contactor på Facebook">
                            <FontAwesomeIcon icon={faFacebookSquare} />
                        </Link>
                        <Link href={CAREERS_SOCIALS.linkedin} target="_blank" aria-label="Contactor på LinkedIn">
                            <FontAwesomeIcon icon={faLinkedin} />
                        </Link>
                        <Link href={CAREERS_SOCIALS.instagram} target="_blank" aria-label="Contactor på Instagram">
                            <FontAwesomeIcon icon={faInstagram} />
                        </Link>
                    </div>
                </div>
                <div>
                    <h3 className={headingClassName}>Kontakt</h3>
                    <SpecialCmsLink
                        special="CAREER_CONTACT"
                        className={`
                            ${cmsLinkTextClassName}
                            [&>a]:text-white/80 [&>a]:text-m [&>a]:font-normal
                            [&>a:hover]:text-white
                        `}
                        capabilities={{ canEdit: capabilities.canEditSpecialCmsLink }}
                        readSpecialCmsLinkAction={readCareerSpecialCmsLinkAction}
                        updateCmsLinkAction={updateCareerSpecialCmsLinkAction}
                    />
                </div>
                <div>
                    <h3 className={headingClassName}>Adresse</h3>
                    <p className={textClassName}>Contactor NTNU</p>
                    <p className={textClassName}>Høgskoleringen 1</p>
                    <p className={textClassName}>7034 Trondheim</p>
                </div>
            </div>
            <div className="border-t border-white/15">
                <div className={`
                    ${innerClassName}
                    flex justify-between gap-4 py-4
                `}>
                    <span className="text-s text-white/80">© Contactor NTNU</span>
                    <Link href="/" className="
                        text-s text-white/80
                        hover:text-white
                    ">Tilbake til Omegaveven</Link>
                </div>
            </div>
        </footer>
    )
}
