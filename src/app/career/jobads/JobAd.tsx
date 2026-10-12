import styles from './JobAd.module.scss'
import Image from '@/components/Image/Image'
import SponsorBadge from '@/components/Company/SponsorBadge'
import { formatVevenUri } from '@/lib/urlEncoding'
import { jobAdType } from '@/services/career/jobAds/constants'
import Link from 'next/link'
import type { SimpleJobAd } from '@/services/career/jobAds/types'

type PropTypes = {
    jobAd: SimpleJobAd
}

const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export default function JobAd({ jobAd }: PropTypes) {
    const deadline = jobAd.applicationDeadline

    return (
        <Link
            href={`/career/jobads/${formatVevenUri(jobAd.articleName, jobAd.id)}`}
            className={styles.JobAd}
        >
            <div className={styles.thumb}>
                {jobAd.coverImage && (
                    <Image
                        disableLinkingToLicense
                        creditPlacement="top"
                        width={200}
                        image={jobAd.coverImage}
                    />
                )}
            </div>

            <div className={styles.lead}>
                {deadline ? <>
                    <b>{deadline.getDate()}</b>
                    <span>{months[deadline.getMonth()]}</span>
                </> : (
                    <span className={styles.noDeadline}>Løpende</span>
                )}
            </div>

            <div className={styles.main}>
                <h2>{jobAd.articleName}</h2>
                <p>
                    <SponsorBadge
                        sponsorTier={jobAd.companySponsorTier}
                        iconOnly
                        className={styles.sponsorMark}
                    />
                    {jobAd.companyName} — {jobAdType[jobAd.type].label}
                </p>
            </div>

            <div className={styles.meta}>
                {jobAd.location && <span>{jobAd.location}</span>}
                {!jobAd.active && <span className={styles.inactive}>Inaktiv</span>}
            </div>
        </Link>
    )
}
