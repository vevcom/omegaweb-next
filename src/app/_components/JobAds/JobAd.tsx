import Image from '@/components/Image/Image'
import SponsorBadge from '@/components/Company/SponsorBadge'
import { formatVevenUri } from '@/lib/urlEncoding'
import { osloDateTime } from '@/lib/dates/oslo'
import { jobAdType } from '@/services/career/jobAds/constants'
import Link from 'next/link'
import type { SimpleJobAd } from '@/services/career/jobAds/types'

type PropTypes = {
    jobAd: SimpleJobAd
    /** The job ads page the row links under, which differs between Omega's site and the career site. */
    basePath: string
}

const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export default function JobAd({ jobAd, basePath }: PropTypes) {
    const deadline = jobAd.applicationDeadline ? osloDateTime(jobAd.applicationDeadline) : null

    return (
        <Link
            href={`${basePath}/${formatVevenUri(jobAd.articleName, jobAd.id)}`}
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
                    <span className="text-s text-text-muted normal-case text-center">Løpende</span>
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
                    <span className="bg-accent-red text-text-inv px-2 rounded-inner font-medium">Inaktiv</span>
                )}
            </div>
        </Link>
    )
}
