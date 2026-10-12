import styles from './FooterSponsors.module.scss'
import Image from '@/components/Image/Image'
import { companyOperations } from '@/services/career/companies/operations'
import { withFallback, withPageSession } from '@/app/serverPage'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { SponsorCompany } from '@/services/career/companies/types'

const MAIN_LOGO_WIDTH = 190
const SPONSOR_LOGO_WIDTH = 110

function SponsorLink({ sponsor, children }: { sponsor: SponsorCompany, children: ReactNode }) {
    if (!sponsor.website) return <span className={styles.sponsor}>{children}</span>

    return (
        <Link className={styles.sponsor} href={sponsor.website} target="_blank" rel="noreferrer">
            {children}
        </Link>
    )
}

function Sponsor({ sponsor, width }: { sponsor: SponsorCompany, width: number }) {
    return (
        <SponsorLink sponsor={sponsor}>
            {sponsor.logo.image ? (
                <Image
                    image={sponsor.logo.image}
                    alt={sponsor.name}
                    width={width}
                    hideCredit
                    hideCopyRight
                    disableLinkingToLicense
                />
            ) : (
                <span className={styles.fallbackName}>{sponsor.name}</span>
            )}
        </SponsorLink>
    )
}

export default async function FooterSponsors() {
    const sponsors = await withPageSession(() => withFallback(companyOperations.readSponsors({}), []))

    if (!sponsors.length) return <></>

    const mainSponsor = sponsors.find(sponsor => sponsor.sponsorTier === 'MAIN')
    const otherSponsors = sponsors.filter(sponsor => sponsor.sponsorTier !== 'MAIN')

    return (
        <div className={styles.FooterSponsors}>
            {mainSponsor && (
                <div className={styles.main}>
                    <Sponsor sponsor={mainSponsor} width={MAIN_LOGO_WIDTH} />
                </div>
            )}
            {otherSponsors.length > 0 && (
                <div className={styles.others}>
                    {otherSponsors.map(sponsor =>
                        <Sponsor key={sponsor.id} sponsor={sponsor} width={SPONSOR_LOGO_WIDTH} />
                    )}
                </div>
            )}
        </div>
    )
}
