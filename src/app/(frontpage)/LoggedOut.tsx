import Section from './Section'
import InfoBubbles from './InfoBubbles'
import {
    footerClassName,
    frontImgPartClassName,
    frontInfoClassName,
    frontInfoInnerClassName,
    omegamaiPartClassName,
    scrollDownClassName,
    taktlausePartClassName,
    wrapperClassName,
} from './frontpageClassNames'
import { MazeMapLophtet } from '@/components/MazeMap/MazeMap'
import SocialIcons from '@/components/SocialIcons/SocialIcons'
import StandardImageServer from '@/components/Image/StandardImageServer'
import { ServerSession } from '@/auth/session/ServerSession'
import { frontpageAuth } from '@/services/frontpage/auth'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import Footer from '@/components/Footer/Footer'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { faAngleDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'

// Important flags: btn/secondary-btn set their own margin and padding at the same specificity.
const ctaLayout = 'w-full m-0! py-5! px-6!'

export default async function LoggedOutLandingPage() {
    const session = await ServerSession.fromNextAuth()
    const capabilities = runCapabilities(session, {
        canEditSpecialCmsImage: frontpageAuth.updateSpecialCmsImage,
        canEditSpecialCmsParagraph: frontpageAuth.updateSpecialCmsParagraphContentSection,
    })

    return (
        <div className={wrapperClassName}>
            <PageTitleSetter title="Sct. Omega Broderskab" />
            <div className={frontImgPartClassName}>
                <div className={frontInfoClassName(false)}>
                    <div className={frontInfoInnerClassName}>
                        <div className="
                            grid place-items-center p-8 rounded-full bg-radial-[circle] from-black/80 from-0%
                            to-transparent to-70%
                        ">
                            <StandardImageServer
                                standardImage="LOGO_WHITE"
                                width={300}
                                tint="white"
                            />
                        </div>

                        <Link className={`
                            secondary-btn font-medium
                            ${ctaLayout}
                        `} href="login">Logg inn</Link>
                        <Link className={`
                            btn font-bold
                            ${ctaLayout}
                        `} href="/new-student">Ny student</Link>
                        <Link className={`
                            secondary-btn font-medium
                            ${ctaLayout}
                        `} href="/career">For bedrifter</Link>

                        <Link className={scrollDownClassName} href="#firstSection">
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
                    <div className="
                        mt-4
                        [&>a]:mr-2 [&>a]:text-text [&>a]:transition-colors [&>a]:duration-300
                        [&>a:hover]:text-accent-blue
                    ">
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
            <div className={omegamaiPartClassName}>
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
            <div className={taktlausePartClassName}>
                <MazeMapLophtet height={'80vh'}/>
            </div>
            <div className={footerClassName}>
                <Footer />
            </div>
        </div>
    )
}
