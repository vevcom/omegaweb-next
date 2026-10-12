import styles from './page.module.scss'
import loggedInStyles from './LoggedIn.module.scss'
import LoggedInSection from './LoggedInSection'
import PromoBar from './PromoBar'
import EventCard from '@/app/_components/Event/EventCard'
import JobAd from '@/app/career/jobads/JobAd'
import NewsCard from '@/app/news/NewsCard'
import OmbulRow from '@/app/ombul/OmbulRow'
import OmegaquoteRow from '@/app/omegaquotes/OmegaquoteRow'
import StandardImageServer from '@/components/Image/StandardImageServer'
import { newsOperations } from '@/services/news/operations'
import { promoOperations } from '@/services/promo/operations'
import { jobAdOperations } from '@/services/career/jobAds/operations'
import { eventOperations } from '@/services/events/operations'
import { ombulOperations } from '@/services/ombul/operations'
import { omegaquoteOperations } from '@/services/omegaquotes/operations'
import { ombulAuth } from '@/services/ombul/auth'
import { omegaQuotesAuth } from '@/services/omegaquotes/auth'
import { withPageSession } from '@/app/serverPage'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import Footer from '@/components/Footer/Footer'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { faAngleDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'

export default async function LoggedInLandingPage() {
    const MAX_NUMBER_OF_ELEMENTS = 3

    const {
        promo, news, jobAds, events, ombuls, omegaquotes, capabilities,
    } = await withPageSession(async (session) => {
        const [newsRead, jobAdsRead, eventsRead, promoRead] = await Promise.all([
            newsOperations.readCurrent({}),
            jobAdOperations.readActive({}),
            eventOperations.readManyCurrent({ params: { tags: null } }),
            promoOperations.readActive({}),
        ])

        // Ombul and omegaquotes are membership permissions rather than default ones, so a logged
        // in user without them gets the islands left out entirely instead of an error page.
        const sessionCapabilities = runCapabilities(session, {
            canReadOmbul: ombulAuth.readAll,
            canReadOmegaquotes: omegaQuotesAuth.readPage,
        })
        const ombulsRead = sessionCapabilities.canReadOmbul.authorized
            ? (await ombulOperations.readAll({})).slice(0, MAX_NUMBER_OF_ELEMENTS)
            : []

        const omegaquotesRead = sessionCapabilities.canReadOmegaquotes.authorized
            ? await omegaquoteOperations.readPage({
                params: {
                    paging: {
                        page: {
                            pageSize: MAX_NUMBER_OF_ELEMENTS,
                            page: 0,
                            cursor: null,
                        },
                        details: undefined,
                    }
                }
            })
            : []

        return {
            promo: promoRead,
            news: newsRead.slice(0, MAX_NUMBER_OF_ELEMENTS),
            jobAds: jobAdsRead.slice(0, MAX_NUMBER_OF_ELEMENTS),
            events: eventsRead.slice(0, MAX_NUMBER_OF_ELEMENTS),
            ombuls: ombulsRead,
            omegaquotes: omegaquotesRead,
            capabilities: sessionCapabilities,
        }
    })

    return (
        <div className={styles.wrapper}>
            <PageTitleSetter title={'Sct. Omega'} />
            <div className={`${styles.part} ${styles.frontImg}`}>
                <div
                    className={`${styles.frontInfo} ${promo ? styles.withPromoBar : ''}`}
                >
                    <div>
                        <StandardImageServer
                            standardImage="LOGO_WHITE"
                            width={300}
                            tint="white"
                        />
                        <Link className={styles.scrollDown} href="#firstSection">
                            <FontAwesomeIcon icon={faAngleDown} />
                        </Link>
                    </div>
                </div>
            </div>
            {promo && (
                <div className={loggedInStyles.promoBarPart}>
                    <PromoBar promo={promo} />
                </div>
            )}
            <div id="firstSection" className={`${styles.part} ${loggedInStyles.loggedInPart}`}>
                <div>
                    <div className={loggedInStyles.islands}>
                        <LoggedInSection title="Nyheter" link="/news" emptyMessage="Det er for tiden ingen nyheter">
                            {news.map((newsArticle, key) => (
                                <NewsCard key={key} news={newsArticle} />
                            ))}
                        </LoggedInSection>
                        <LoggedInSection
                            title="Hvad der hender"
                            link="/events"
                            layout="rows"
                            span="half"
                            emptyMessage="Det er for tiden ingen kommende hendelser"
                        >
                            {events.map((event, key) => (
                                <EventCard key={key} event={event} />
                            ))}
                        </LoggedInSection>
                        <LoggedInSection
                            title="Jobbannonser"
                            link="/career/jobads"
                            layout="rows"
                            span="half"
                            emptyMessage="Det er for tiden ingen jobbannonser"
                        >
                            {jobAds.map((jobAd, key) => (
                                <JobAd key={key} jobAd={jobAd} />
                            ))}
                        </LoggedInSection>
                        {capabilities.canReadOmbul.authorized && (
                            <LoggedInSection
                                title="Ombul"
                                link="/ombul"
                                layout="rows"
                                span="half"
                                emptyMessage="Det er ingen ombuler å vise enda"
                            >
                                {ombuls.map(ombul => (
                                    <OmbulRow key={ombul.id} ombul={ombul} />
                                ))}
                            </LoggedInSection>
                        )}
                        {capabilities.canReadOmegaquotes.authorized && (
                            <LoggedInSection
                                title="Omegaquotes"
                                link="/omegaquotes"
                                layout="rows"
                                span="half"
                                emptyMessage="Det er ingen quotes å vise enda"
                            >
                                {omegaquotes.map(quote => (
                                    <OmegaquoteRow key={quote.id} quote={quote} />
                                ))}
                            </LoggedInSection>
                        )}
                        {/* Images section doesnt really fit for the logged in landing page.
                        <LoggedInSection title="Bilder" link="/image-collections">
                            Her kan man kanskje vise noen bilder ellerno
                        </LoggedInSection>
                        */}
                    </div>
                </div>
            </div>
            <div className={styles.footer}>
                <Footer />
            </div>
        </div>
    )
}
