import styles from './page.module.scss'
import { careerSections, CONTACTOR_EMAIL } from './_components/contactorSite'
import SpecialCmsParagraph from '@/components/Cms/CmsParagraph/SpecialCmsParagraph'
import SpecialCmsImage from '@/components/Cms/CmsImage/SpecialCmsImage'
import StandardImageServer from '@/components/Image/StandardImageServer'
import { eventTagOperations } from '@/services/events/tags/operations'
import {
    readCareerSpecialCmsImageAction,
    readCareerSpecialCmsParagraphAction,
    updateCareerSpecialCmsImageAction,
    updateCareerSpecialCmsParagraphContentAction,
} from '@/services/career/actions'
import { careerAuth } from '@/services/career/auth'
import { serverPage, withFallback } from '@/app/ServerPage'
import Link from 'next/link'

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
    }),
    // Absolute: the layout's "| Contactor NTNU" template only applies to the segments under it,
    // and the frontpage is the site's own name.
    metadata: () => ({ title: { absolute: 'Contactor NTNU' } }),
    render: ({ data, capabilities }) => (
        <div className={styles.page}>
            <section className={styles.hero}>
                <div className={styles.heroText}>
                    <span className={styles.badge}>Bedriftskontakt NTNU</span>
                    <SpecialCmsParagraph
                        capabilities={{ canEdit: capabilities.canEditSpecialCmsParagraph }}
                        className={styles.heroParagraph}
                        special="CAREER_HERO"
                        readSpecialCmsParagraphAction={readCareerSpecialCmsParagraphAction}
                        updateCmsParagraphAction={updateCareerSpecialCmsParagraphContentAction}
                    />
                    <div className={styles.actions}>
                        <Link className={styles.primaryButton} href={`mailto:${CONTACTOR_EMAIL}`}>
                            Ta kontakt
                        </Link>
                        <Link className={styles.secondaryButton} href="#tilbud">
                            Les mer om hva vi tilbyr
                        </Link>
                    </div>
                </div>
                <div className={styles.heroImage}>
                    <SpecialCmsImage
                        capabilities={{ canEdit: capabilities.canEditSpecialCmsImage }}
                        special="CAREER_HERO"
                        width={900}
                        readSpecialCmsImageAction={readCareerSpecialCmsImageAction}
                        updateCmsImageAction={updateCareerSpecialCmsImageAction}
                    />
                </div>
            </section>

            <section id="tilbud" className={styles.services}>
                <div className={styles.sectionHead}>
                    <span className={styles.badge}>Våre tjenester</span>
                    <h2>Alt du trenger for å nå studentene</h2>
                    <p>
                        Vi tilbyr skreddersydde løsninger for bedrifter som ønsker å rekruttere de beste
                        teknologistudentene.
                    </p>
                </div>
                <div className={styles.cards}>
                    {careerSections(data.companyPresentationEventTag).map(section => (
                        <Link key={section.href} href={section.href} className={styles.card}>
                            <StandardImageServer
                                disableLinkingToLicense
                                className={styles.cardImage}
                                width={600}
                                standardImage={section.standardImage}
                            />
                            <h3>{section.name}</h3>
                            <p>{section.description}</p>
                        </Link>
                    ))}
                </div>
            </section>

            <section className={styles.about}>
                <span className={styles.badge}>Om oss</span>
                <SpecialCmsParagraph
                    capabilities={{ canEdit: capabilities.canEditSpecialCmsParagraph }}
                    className={styles.aboutParagraph}
                    special="CAREER_INFO"
                    readSpecialCmsParagraphAction={readCareerSpecialCmsParagraphAction}
                    updateCmsParagraphAction={updateCareerSpecialCmsParagraphContentAction}
                />
            </section>

            <section className={styles.cta}>
                <h2>Klar for å møte fremtidens ingeniører?</h2>
                <p>Send oss en henvendelse, så tar vi oss av alt det praktiske.</p>
                <Link className={styles.primaryButton} href={`mailto:${CONTACTOR_EMAIL}`}>
                    Ta kontakt nå
                </Link>
            </section>
        </div>
    ),
})

export default page
export { generateMetadata }
