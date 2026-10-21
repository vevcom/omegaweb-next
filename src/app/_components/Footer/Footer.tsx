import FooterSponsors from './FooterSponsors'
import SocialIcons from '@/components/SocialIcons/SocialIcons'
import StandardImageServer from '@/components/Image/StandardImageServer'

// On mobile every column of the footer stacks and centres.
const mobileColumnClassName = `
    max-mobile:flex-[0_1_auto] max-mobile:max-w-full max-mobile:p-0 max-mobile:mt-10 max-mobile:flex max-mobile:flex-col
    max-mobile:items-center
`

const infoClassName = `
    flex-[1_1_calc(28*var(--gap))] pl-4 border-l border-text-muted
    [&>*:first-child]:text-accent-blue [&>*:first-child]:font-medium [&>*:first-child]:text-l
    [&_a]:no-underline [&_a]:text-text
    [&_a:hover]:underline
    max-mobile:flex-[1_1_0] max-mobile:border-l-0 max-mobile:pl-0
    max-mobile:[&:not(:first-child)]:mt-10
`

function Footer() {
    const emailDomain = process.env.EMAIL_DOMAIN

    return (
        <footer className="
            font-light layer text-text flex flex-wrap rounded-round py-20
            px-[clamp(calc(2*var(--gap)),5vw,calc(20*var(--gap)))]
            [&_p]:mb-2 [&_p]:leading-[1.7em]
            max-mobile:pt-2 max-mobile:px-4 max-mobile:pb-8 max-mobile:flex-col max-mobile:items-center
            max-mobile:[&_p]:text-center max-mobile:[&_p]:max-w-[400px]
        ">
            <div className={`
                flex-[2_1_calc(40*var(--gap))] pl-0 pr-10
                ${mobileColumnClassName}
            `}>
                <StandardImageServer
                    standardImage="LOGO_WHITE_TEXT"
                    className="
                        block max-w-full
                        [&>*]:max-w-full
                    "
                    width={350}
                    tint="var(--text)"
                    tintAspectRatio={1657.3333 / 210.66667}
                />
                <p>
                Linjeforeningen for Elektronisk Systemdesign
                og Innovasjon (MTELSYS) og Kybernetikk og
                Robotikk (MTTK) ved Norges Tekniske-Naturvitenskapelige Universitet (NTNU)
                </p>
                <p>Org. Nr. 890 384 692</p>
                <div>
                    <div className="
                        flex justify-start
                        max-mobile:justify-center
                        [&_a>*]:text-accent-blue [&_a>*]:p-2 [&_a>*]:size-[30px]
                        [&_a>*:hover]:text-[color-mix(in_srgb,var(--accent-blue),black_10%)] [&_a>*:hover]:cursor-pointer
                        [&_a>*>*:first-child]:pl-0
                    ">
                        <SocialIcons />
                    </div>
                </div>
            </div>
            <div className={`
                flex-[2_1_calc(61*var(--gap))] flex flex-wrap gap-y-4 gap-x-10 p-0
                ${mobileColumnClassName}
                max-mobile:w-full max-mobile:gap-0
            `}>
                <div className={infoClassName}>
                    <p>Kontakt:</p>
                    <p>Bedrift: <a href="mailto:post@contactor.no">post@contactor.no</a></p>
                    <p>Teknisk: <a href={`mailto:vevcom@${emailDomain}`}>vevcom@{emailDomain}</a></p>
                    <p>PR: <a href={`mailto:blaest@${emailDomain}`}>blaest@{emailDomain}</a></p>
                    <p>Annet: <a href={`mailto:hs@${emailDomain}`}>hs@{emailDomain}</a></p>
                    <p>Tlf: <a href="tel:73594211">73 59 42 11</a></p>
                </div>
                <div className={infoClassName}>
                    <p>Adresse:</p>
                    <p>Sct.Omega Broderskab</p>
                    <p>NTNU Gløshaugen</p>
                    <p>Elektro-bygget</p>
                    <p>7491 Trondheim</p>
                </div>
            </div>
            <div className={`
                flex-[1_1_calc(30*var(--gap))] pr-10 pl-4 flex justify-center items-center
                ${mobileColumnClassName}
            `}>
                <FooterSponsors />
            </div>
        </footer>
    )
}

export default Footer
