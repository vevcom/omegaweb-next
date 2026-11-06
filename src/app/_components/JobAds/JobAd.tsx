import { jobAdLinks } from '@/pageKits/jobAds/links'
import Image from '@/components/Image/Image'
import SponsorBadge from '@/components/Company/SponsorBadge'
import { osloDateTime } from '@/lib/dates/oslo'
import { jobAdType } from '@/services/careers/jobAds/constants'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { SimpleJobAd } from '@/services/careers/jobAds/types'
import type { JobAdPagesConfig } from '@/pageKits/jobAds/config'

type PropTypes = {
    jobAd: SimpleJobAd
    /** The job ad pages the row links into, which differ between Omega's site and the career site. */
    config: JobAdPagesConfig
}

const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export default function JobAd({ jobAd, config }: PropTypes) {
    const deadline = jobAd.applicationDeadline ? osloDateTime(jobAd.applicationDeadline) : null

    return (
        <SiteLink
            href={jobAdLinks(config).jobAd(jobAd)}
            className="list-row"
        >
            <div className="list-row-thumb">
                {jobAd.coverImage && (
                    <Image
                        disableLinkingToLicense
                        creditPlacement="top"
                        width={200}
                        image={jobAd.coverImage}
                    />
                )}
            </div>

            <div className="list-row-lead">
                {deadline ? <>
                    <b>{deadline.day}</b>
                    <span>{months[deadline.month - 1]}</span>
                </> : (
                    <span className="text-s text-base-content/80 normal-case text-center">Løpende</span>
                )}
            </div>

            <div className="list-row-main">
                <h2>{jobAd.articleName}</h2>
                <p>
                    <SponsorBadge
                        sponsorTier={jobAd.companySponsorTier}
                        iconOnly
                        className="align-middle mr-1.5"
                    />
                    {jobAd.companyName} — {jobAdType[jobAd.type].label}
                </p>
            </div>

            <div className="list-row-meta">
                {jobAd.location && <span>{jobAd.location}</span>}
                {!jobAd.active && (
                    <span className="bg-error text-error-content px-2 rounded-inner font-medium">Inaktiv</span>
                )}
            </div>
        </SiteLink>
    )
}
