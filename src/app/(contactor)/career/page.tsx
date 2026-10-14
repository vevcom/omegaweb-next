import styles from './page.module.scss'
import ContactorHeroShape from '@/app/(contactor)/_components/ContactorHeroShape'
import UpcomingCompanyPresentations from '@/app/(contactor)/_components/UpcomingCompanyPresentations'
import { CAREER_PATH, companyPresentationsHref } from '@/app/(contactor)/_lib/contactorSite'
import SpecialCmsParagraph from '@/components/Cms/CmsParagraph/SpecialCmsParagraph'
import SpecialCmsImage from '@/components/Cms/CmsImage/SpecialCmsImage'
import SpecialCmsLink from '@/components/Cms/CmsLink/SpecialCmsLink'
import { eventTagOperations } from '@/services/events/tags/operations'
import {
    readCareerSpecialCmsImageAction,
    readCareerSpecialCmsLinkAction,
    readCareerSpecialCmsParagraphAction,
    updateCareerSpecialCmsImageAction,
    updateCareerSpecialCmsLinkAction,
    updateCareerSpecialCmsParagraphContentAction,
} from '@/services/career/actions'
import { careerAuth } from '@/services/career/auth'
import { serverPage, withFallback } from '@/app/ServerPage'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type {
    SpecialCmsLink as SpecialCmsLinkT,
    SpecialCmsParagraph as SpecialCmsParagraphT,
} from '@/prisma-generated-pn-types'

/** The two study programmes Contactor represents, each with its paragraph and its links to NTNU. */
const programmes: {
    name: string,
    paragraph: SpecialCmsParagraphT,
    links: SpecialCmsLinkT[],
}[] = [
    {
        name: 'Kybernetikk og Robotikk',
        paragraph: 'CAREER_PROGRAMME_CYBERNETICS',
        links: ['CAREER_CYBERNETICS_FIVE_YEAR', 'CAREER_CYBERNETICS_TWO_YEAR'],
    },
    {
        name: 'Elektronisk Systemdesign og Innovasjon',
        paragraph: 'CAREER_PROGRAMME_ELECTRONICS',
        links: ['CAREER_ELECTRONICS_FIVE_YEAR', 'CAREER_ELECTRONICS_TWO_YEAR'],
    },
]

const { page, generateMetadata } = serverPage({
    operation: async () => ({
        companyPresentationEventTag: await withFallback(
            eventTagOperations.readSpecial({ params: { special: 'COMPANY_PRESENTATION' } }),
            null
        ),
    }),
    capabilities: () => ({
        canEditSpecialCmsParagraph: careerAuth.updateSpecialCmsParagraphContent,
        canEditSpecialCmsImage: careerAuth.updateSpecialCmsImage,
        canEditSpecialCmsLink: careerAuth.updateSpecialCmsLink,
    }),
    // Absolute: the layout's "| Contactor NTNU" template only applies to the segments under it,
    // and the frontpage is the site's own name.
    metadata: () => ({ title: { absolute: 'Contactor NTNU' } }),
    render: ({ data, capabilities }) => {
        const paragraphActions = {
            capabilities: { canEdit: capabilities.canEditSpecialCmsParagraph },
            readSpecialCmsParagraphAction: readCareerSpecialCmsParagraphAction,
            updateCmsParagraphAction: updateCareerSpecialCmsParagraphContentAction,
        }
        const linkActions = {
            capabilities: { canEdit: capabilities.canEditSpecialCmsLink },
            readSpecialCmsLinkAction: readCareerSpecialCmsLinkAction,
            updateCmsLinkAction: updateCareerSpecialCmsLinkAction,
        }
        return (
            <div className={styles.page}>
                <section className={styles.hero}>
                    <ContactorHeroShape variant="desktop" />
                    <div className={styles.inner}>
                        <ContactorHeroShape variant="mobile" />
                        <div className={styles.heroText}>
                            <span className={styles.badge}>Bedriftskontakt NTNU</span>
                            <h1>
                                Der <span className={styles.highlight}>bedrifter</span> &amp;{' '}
                                {'teknologi­studenter'} møtes
                            </h1>
                            <p className={styles.subtitle}>Broen mellom studenter og næringslivet</p>
                            <div className={styles.actions}>
                                <SpecialCmsLink special="CAREER_CONTACT" className={styles.contactLink} {...linkActions} />
                            </div>
                        </div>
                    </div>
                </section>

                <UpcomingCompanyPresentations eventsHref={companyPresentationsHref(data.companyPresentationEventTag)} />

                <section id="studieprogrammene" className={styles.programmes}>
                    <div className={styles.inner}>
                        <div className={styles.programmesIntro}>
                            <span className={styles.badge}>Studieprogrammene</span>
                            <h2>Hvem representerer vi?</h2>
                            <SpecialCmsParagraph
                                special="CAREER_PROGRAMMES"
                                className={styles.paragraph}
                                {...paragraphActions}
                            />
                        </div>
                        <div className={styles.programmeGrid}>
                            {programmes.map(programme => (
                                <article key={programme.name} className={styles.programme}>
                                    <h3>{programme.name}</h3>
                                    <SpecialCmsParagraph
                                        special={programme.paragraph}
                                        className={styles.paragraph}
                                        {...paragraphActions}
                                    />
                                    <div className={styles.programmeLinks}>
                                        {programme.links.map(link => (
                                            <SpecialCmsLink
                                                key={link}
                                                special={link}
                                                className={styles.link}
                                                {...linkActions}
                                            />
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className={styles.about}>
                    <div className={styles.inner}>
                        <div className={styles.aboutText}>
                            <span className={styles.badge}>Om oss</span>
                            <h2>Et dedikert team av studenter</h2>
                            <SpecialCmsParagraph special="CAREER_ABOUT" className={styles.paragraph} {...paragraphActions} />
                            <Link href={`${CAREER_PATH}/about`} className={styles.primaryButton}>
                                Møt teamet
                                <FontAwesomeIcon icon={faArrowRight} />
                            </Link>
                        </div>
                        <div className={styles.aboutImage}>
                            <SpecialCmsImage
                                special="CAREER_ABOUT"
                                width={900}
                                capabilities={{ canEdit: capabilities.canEditSpecialCmsImage }}
                                readSpecialCmsImageAction={readCareerSpecialCmsImageAction}
                                updateCmsImageAction={updateCareerSpecialCmsImageAction}
                            />
                        </div>
                    </div>
                </section>

                <section className={styles.cta}>
                    <div className={styles.inner}>
                        <h2>Klar for å møte fremtidens ingeniører?</h2>
                        <p>Send oss en henvendelse, så tar vi oss av alt det praktiske.</p>
                        <SpecialCmsLink special="CAREER_CONTACT" className={styles.ctaLink} {...linkActions} />
                    </div>
                </section>
            </div>
        )
    },
})

export default page
export { generateMetadata }
