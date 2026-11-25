import { companyPresentationLinks } from '@/app/(careers)/career/company-presentations/links'
import { careerJobAdLinks } from '@/app/(careers)/career/job-ads/links'
import { bandClassName, innerClassName } from '@/app/(careers)/_lib/careersClassNames'
import Image from '@/components/Image/Image'
import StandardImageServer from '@/components/Image/StandardImageServer'
import SiteLink from '@/components/SiteLink/SiteLink'
import { displayDate } from '@/lib/dates/displayDate'
import type { ExpandedCareerFrontpageHighlight } from '@/services/careers/frontpage/highlights/types'
import type { AppHref } from '@/lib/sites/href'
import type { ExpandedImage } from '@/services/images/subservice/types'

type PropTypes = {
    highlights: ExpandedCareerFrontpageHighlight[],
}

type Item = {
    key: string,
    href: AppHref,
    kind: string,
    title: string,
    detail: string,
    image: ExpandedImage | null,
    imageClassName: string,
}

function itemsOf({ id, event, jobAd }: ExpandedCareerFrontpageHighlight): Item[] {
    if (event) {
        return [{
            key: `event-${id}`,
            href: companyPresentationLinks.event(event),
            kind: 'Bedriftspresentasjon',
            title: event.name,
            detail: displayDate(event.eventStart, false),
            image: event.coverImage.image,
            imageClassName: '[&_img]:object-cover',
        }]
    }
    if (jobAd) {
        return [{
            key: `jobAd-${id}`,
            href: careerJobAdLinks.jobAd(jobAd),
            kind: 'Jobbannonse',
            title: jobAd.articleName,
            detail: jobAd.company.name,
            image: jobAd.company.logoImage,
            imageClassName: '[&_img]:object-contain',
        }]
    }
    return []
}

/** The band under the hero with what the administrators have chosen to highlight right now. */
export default function CareerFrontpageHighlights({ highlights }: PropTypes) {
    if (!highlights.length) return null
    return (
        <section
            aria-label="Aktuelt"
            className={`
                ${bandClassName}
                border-y border-careers-line bg-base-200
            `}
        >
            <div className={`
                ${innerClassName}
                flex flex-col gap-4 py-6
            `}>
                <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2">
                    <span className="text-careers-accent-dark text-s font-semibold tracking-[0.15em] uppercase">
                        Aktuelt
                    </span>
                    <SiteLink href={companyPresentationLinks.list()} className="text-careers-navy text-m font-semibold">
                        Alle bedriftspresentasjoner →
                    </SiteLink>
                </div>
                <ul className="flex gap-6 m-0 p-0 list-none overflow-x-auto snap-x snap-mandatory [scrollbar-width:none]">
                    {highlights.flatMap(itemsOf).map(item => (
                        <li key={item.key} className="shrink-0 w-52 snap-start">
                            <SiteLink href={item.href} className="group block text-inherit no-underline">
                                <div className={`
                                    [--image-width:100%] overflow-hidden h-28 rounded-[calc(var(--rounding)/2)] bg-white
                                    [&>div]:block [&>div]:size-full
                                    [&_img]:size-full
                                    ${item.imageClassName}
                                `}>
                                    {item.image
                                        ? <Image image={item.image} alt="" width={300} hideCredit hideCopyRight />
                                        : <StandardImageServer
                                            standardImage="DEFAULT_IMAGE"
                                            alt=""
                                            width={300}
                                            hideCredit
                                            hideCopyRight
                                        />}
                                </div>
                                <span className="block mt-3 text-careers-accent-dark text-xs font-semibold uppercase">
                                    {item.kind}
                                </span>
                                <span className="
                                    block text-careers-navy text-m font-semibold leading-[1.3] line-clamp-2
                                    group-hover:underline
                                ">
                                    {item.title}
                                </span>
                                <span className="block text-base-content/80 text-s">{item.detail}</span>
                            </SiteLink>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}
