import Section from './Section'
import styles from './page.module.scss'
import sectionStyles from './Section.module.scss'
import InfoBubbles from './InfoBubbles'
import { MazeMapLophtet } from '@/components/MazeMap/MazeMap'
import SocialIcons from '@/components/SocialIcons/SocialIcons'
import StandardImageServer from '@/components/Image/StandardImageServer'
import YouTube from '@/components/YouTube/YouTube'
import { ServerSession } from '@/auth/session/ServerSession'
import { frontpageAuth } from '@/services/frontpage/auth'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import Footer from '@/components/Footer/Footer'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { faAngleDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'

export default async function LoggedOutLandingPage() {
    const session = await ServerSession.fromNextAuth()
    const capabilities = runCapabilities(session, {
        canEditSpecialCmsImage: frontpageAuth.updateSpecialCmsImage,
        canEditSpecialCmsParagraph: frontpageAuth.updateSpecialCmsParagraphContentSection,
    })

    return (
        <div className={styles.wrapper}>
            <PageTitleSetter title={'Sct. Omega'} />
            <div className={`${styles.part} ${styles.frontImg}`}>
                <div className={styles.frontInfo}>
                    <div>
                        <div className={styles.crest}>
                            <StandardImageServer
                                standardImage="LOGO_WHITE"
                                width={300}
                                tint="white"
                            />
                        </div>

                        <Link href="login">Logg inn</Link>
                        <Link className={styles.primaryCta} href="/new-student">Ny student</Link>
                        <Link href="/career">For bedrifter</Link>

                        <Link className={styles.scrollDown} href="#firstSection">
                            <FontAwesomeIcon icon={faAngleDown} />
                        </Link>
                    </div>
                </div>
                <Section
                    capabilities={capabilities}
                    position="left"
                    specialCmsImage="FRONTPAGE_1"
                    specialCmsParagraph="FRONTPAGE_1"
                    readMore="/articles"
                    imgWidth={450}
                    id="firstSection"
                >
                    <div className={sectionStyles.socials}>
                        <SocialIcons />
                    </div>
                </Section>

                <InfoBubbles />
                <Section
                    capabilities={capabilities}
                    position="right"
                    specialCmsImage="FRONTPAGE_2"
                    specialCmsParagraph="FRONTPAGE_2"
                    readMore="/articles"
                    imgWidth={450}
                />

            </div>
            <div className={`${styles.part} ${styles.omegamai}`}>
                <YouTube src="https://www.youtube.com/watch?v=I-zNLW4ILu4" title="Master i kybernetikk og robotikk | NTNU" />
                <Section
                    capabilities={capabilities}
                    position="left"
                    specialCmsImage="FRONTPAGE_3"
                    specialCmsParagraph="FRONTPAGE_3"
                    readMore="/career"
                    imgWidth={760}
                />
                <Section
                    capabilities={capabilities}
                    position="right"
                    specialCmsImage="FRONTPAGE_4"
                    specialCmsParagraph="FRONTPAGE_4"
                    readMore="infopages/loccom"
                    imgWidth={1000}
                />

            </div>
            <div className={`${styles.part} ${styles.taktlause}`}>
                <MazeMapLophtet height={'80vh'}/>
            </div>
            <div className={styles.footer}>
                <Footer />
            </div>
        </div>
    )
}
