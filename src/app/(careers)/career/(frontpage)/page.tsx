import CareersHeroShape from '@/app/(careers)/career/(frontpage)/CareersHeroShape'
import UpcomingCompanyPresentations from '@/app/(careers)/career/(frontpage)/UpcomingCompanyPresentations'
import { CAREER_PATH, companyPresentationPages } from '@/app/(careers)/_lib/careersSite'
import {
    badgeClassName,
    bandClassName,
    buttonClassName,
    cmsLinkButtonClassName,
    cmsLinkTextClassName,
    innerClassName,
    navyCmsLinkClassName,
    sectionHeadingClassName,
} from '@/app/(careers)/_lib/careersClassNames'
import SpecialCmsParagraph from '@/components/Cms/CmsParagraph/SpecialCmsParagraph'
import SpecialCmsImage from '@/components/Cms/CmsImage/SpecialCmsImage'
import SpecialCmsLink from '@/components/Cms/CmsLink/SpecialCmsLink'
import {
    readCareersFrontpageSpecialCmsImageAction,
    readCareersFrontpageSpecialCmsLinkAction,
    readCareersFrontpageSpecialCmsParagraphAction,
    updateCareersFrontpageSpecialCmsImageAction,
    updateCareersFrontpageSpecialCmsLinkAction,
    updateCareersFrontpageSpecialCmsParagraphContentAction,
} from '@/services/careers/frontpage/actions'
import { careersFrontpageAuth } from '@/services/careers/frontpage/auth'
import { serverPage } from '@/app/ServerPage'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type {
    SpecialCmsLink as SpecialCmsLinkT,
    SpecialCmsParagraph as SpecialCmsParagraphT,
} from '@/prisma-generated-pn-types'

/** The two study programmes the career site represents, each with its paragraph and its links to NTNU. */
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

// The CMS paragraph sizes and colours its elements itself; these are the page's own.
const paragraphClassName = `
    [&_:is(p,li)]:leading-[1.7]!
    [&_p+p]:mt-4
`
const navyParagraphClassName = '[&_:is(p,li)]:text-m [&_:is(p,li)]:text-white/70'
const programmeLinkClassName = `
    ${cmsLinkTextClassName}
    [&>a]:text-s [&>a]:font-medium [&>a]:text-white/70
    [&>a:hover]:text-careers-accent-light [&>a:hover]:underline
    [&>a]:after:content-['_↗'] [&>a]:after:text-[0.8em]
`

const { page, generateMetadata } = serverPage({
    operation: () => ({}),
    capabilities: () => ({
        canEditSpecialCmsParagraph: careersFrontpageAuth.updateSpecialCmsParagraphContent,
        canEditSpecialCmsImage: careersFrontpageAuth.updateSpecialCmsImage,
        canEditSpecialCmsLink: careersFrontpageAuth.updateSpecialCmsLink,
    }),
    // Absolute: the layout's "| Contactor NTNU" template only applies to the segments under it,
    // and the frontpage is the site's own name.
    metadata: () => ({ title: { absolute: 'Contactor NTNU' } }),
    render: ({ capabilities }) => {
        const paragraphActions = {
            capabilities: { canEdit: capabilities.canEditSpecialCmsParagraph },
            readSpecialCmsParagraphAction: readCareersFrontpageSpecialCmsParagraphAction,
            updateCmsParagraphAction: updateCareersFrontpageSpecialCmsParagraphContentAction,
        }
        const linkActions = {
            capabilities: { canEdit: capabilities.canEditSpecialCmsLink },
            readSpecialCmsLinkAction: readCareersFrontpageSpecialCmsLinkAction,
            updateCmsLinkAction: updateCareersFrontpageSpecialCmsLinkAction,
        }
        return (
            <div className="flex flex-col">
                <section className={`
                    ${bandClassName}
                    relative overflow-hidden
                `}>
                    <CareersHeroShape variant="desktop" />
                    <div className={`
                        ${innerClassName}
                        relative flex flex-col justify-center min-h-[32rem] py-12
                        max-mobile:min-h-0 max-mobile:pt-0
                    `}>
                        <CareersHeroShape variant="mobile" />
                        <div className="relative max-w-[34rem]">
                            <span className={`
                                ${badgeClassName}
                                text-careers-accent-dark
                            `}>Bedriftskontakt NTNU</span>
                            <h1 className="
                                text-[clamp(2rem,5vw,3.25rem)] leading-[1.1] tracking-[-0.02em]! text-careers-navy
                            ">
                                Der <span className="text-careers-accent">bedrifter</span> &amp;{' '}
                                {'teknologi­studenter'} møtes
                            </h1>
                            <p className="max-w-[36rem] mt-6 text-l leading-[1.6] text-text-muted">
                                Broen mellom studenter og næringslivet
                            </p>
                            <div className="flex flex-wrap gap-4 mt-10">
                                <SpecialCmsLink
                                    special="CAREER_CONTACT"
                                    className={`
                                        ${cmsLinkButtonClassName}
                                        ${navyCmsLinkClassName}
                                    `}
                                    {...linkActions}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <UpcomingCompanyPresentations eventsHref={companyPresentationPages.basePath} />

                <section id="studieprogrammene" className={`
                    ${bandClassName}
                    py-24 bg-careers-navy
                `}>
                    <div className={`
                        ${innerClassName}
                        grid grid-cols-[1fr_2fr] gap-16
                        max-mobile:grid-cols-1
                    `}>
                        <div>
                            <span className={`
                                ${badgeClassName}
                                text-careers-accent-light
                            `}>Studieprogrammene</span>
                            <h2 className={`
                                ${sectionHeadingClassName}
                                mb-6 text-white
                            `}>Hvem representerer vi?</h2>
                            <SpecialCmsParagraph
                                special="CAREER_PROGRAMMES"
                                className={`
                                    ${paragraphClassName}
                                    ${navyParagraphClassName}
                                `}
                                {...paragraphActions}
                            />
                        </div>
                        <div className="
                            grid grid-cols-2 gap-px border border-white/12 bg-white/12
                            max-mobile:grid-cols-1
                        ">
                            {programmes.map(programme => (
                                <article key={programme.name} className="p-10 bg-careers-navy">
                                    <h3 className="mb-4 text-l leading-[1.3] text-white">{programme.name}</h3>
                                    <SpecialCmsParagraph
                                        special={programme.paragraph}
                                        className={`
                                            ${paragraphClassName}
                                            ${navyParagraphClassName}
                                        `}
                                        {...paragraphActions}
                                    />
                                    <div className="flex flex-wrap gap-x-8 gap-y-2 mt-6">
                                        {programme.links.map(link => (
                                            <SpecialCmsLink
                                                key={link}
                                                special={link}
                                                className={programmeLinkClassName}
                                                {...linkActions}
                                            />
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="py-24">
                    <div className={`
                        ${innerClassName}
                        grid grid-cols-2 items-center gap-16
                        max-mobile:grid-cols-1
                    `}>
                        <div>
                            <span className={`
                                ${badgeClassName}
                                text-careers-accent-dark
                            `}>Om oss</span>
                            <h2 className={`
                                ${sectionHeadingClassName}
                                mb-6 text-careers-navy
                            `}>Et dedikert team av studenter</h2>
                            <SpecialCmsParagraph
                                special="CAREER_ABOUT"
                                className={`
                                    ${paragraphClassName}
                                    [&_:is(p,li)]:text-l [&_:is(p,li)]:text-text-muted
                                `}
                                {...paragraphActions}
                            />
                            <Link href={`${CAREER_PATH}/about`} className={`
                                ${buttonClassName}
                                mt-8 bg-careers-navy text-white
                                hover:bg-careers-navy-dark
                            `}>
                                Møt teamet
                                <FontAwesomeIcon icon={faArrowRight} />
                            </Link>
                        </div>
                        <div className={`
                            [--image-width:100%] overflow-hidden rounded-[calc(var(--rounding)/2)] aspect-[4/3]
                            [&>div]:block [&>div]:size-full
                            [&_img]:size-full [&_img]:object-cover
                        `}>
                            <SpecialCmsImage
                                special="CAREER_ABOUT"
                                width={900}
                                capabilities={{ canEdit: capabilities.canEditSpecialCmsImage }}
                                readSpecialCmsImageAction={readCareersFrontpageSpecialCmsImageAction}
                                updateCmsImageAction={updateCareersFrontpageSpecialCmsImageAction}
                            />
                        </div>
                    </div>
                </section>

                <section className={`
                    ${bandClassName}
                    py-24 bg-careers-navy text-center
                `}>
                    <div className={`
                        ${innerClassName}
                        flex flex-col items-center gap-4
                    `}>
                        <h2 className={`
                            ${sectionHeadingClassName}
                            text-white
                        `}>Klar for å møte fremtidens ingeniører?</h2>
                        <p className="max-w-[50ch] text-l text-white/70">
                            Send oss en henvendelse, så tar vi oss av alt det praktiske.
                        </p>
                        <SpecialCmsLink
                            special="CAREER_CONTACT"
                            className={`
                                ${cmsLinkButtonClassName}
                                mt-6
                                [&>a]:bg-white [&>a]:text-careers-navy
                                [&>a:hover]:bg-white/90 [&>a:hover]:text-careers-navy
                            `}
                            {...linkActions}
                        />
                    </div>
                </section>
            </div>
        )
    },
})

export default page
export { generateMetadata }
