import Image from '@/components/Image/Image'
import { companyOperations } from '@/services/career/companies/operations'
import { withFallback, withPageSession } from '@/app/ServerPage'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { SponsorCompany } from '@/services/career/companies/types'

const MAIN_LOGO_WIDTH = 190
const SPONSOR_LOGO_WIDTH = 110

const sponsorClassName = [
    'text-m flex items-center justify-center max-w-full opacity-85 transition-opacity duration-300',
    'hover:opacity-100 hover:no-underline [&_img]:max-w-full [&_img]:h-auto',
    'tone-light:[&_img]:invert tone-light:[&_img]:hue-rotate-180',
].join(' ')

function SponsorLink({ sponsor, children }: { sponsor: SponsorCompany, children: ReactNode }) {
    if (!sponsor.website) return <span className={sponsorClassName}>{children}</span>

    return (
        <Link className={sponsorClassName} href={sponsor.website} target="_blank" rel="noreferrer">
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
                <span className="text-text text-l font-medium text-center">{sponsor.name}</span>
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
        <div className="flex flex-col items-center justify-center gap-8 w-full">
            {mainSponsor && (
                <div className="flex justify-center w-full">
                    <Sponsor sponsor={mainSponsor} width={MAIN_LOGO_WIDTH} />
                </div>
            )}
            {otherSponsors.length > 0 && (
                <div className="flex flex-row flex-wrap items-center justify-center gap-y-4 gap-x-8 w-full">
                    {otherSponsors.map(sponsor =>
                        <Sponsor key={sponsor.id} sponsor={sponsor} width={SPONSOR_LOGO_WIDTH} />
                    )}
                </div>
            )}
        </div>
    )
}
