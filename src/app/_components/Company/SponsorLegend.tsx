import SponsorBadge from './SponsorBadge'
import { companySponsorTierDetails } from '@/services/careers/companies/constants'

export default function SponsorLegend() {
    return (
        <dl className="
            flex flex-col gap-2 m-0 p-4 rounded-inner bg-surface-raised
            [&>div]:flex [&>div]:items-center [&>div]:gap-3
            [&_dt]:shrink-0 [&_dt]:min-w-[15em]
            [&_dd]:m-0 [&_dd]:text-s [&_dd]:text-text-muted
            max-mobile:[&>div]:flex-col max-mobile:[&>div]:items-start max-mobile:[&>div]:gap-1
            max-mobile:[&_dt]:min-w-0
        ">
            <div>
                <dt><SponsorBadge sponsorTier="MAIN" /></dt>
                <dd>{companySponsorTierDetails.MAIN.description}</dd>
            </div>
            <div>
                <dt><SponsorBadge sponsorTier="SPONSOR" /></dt>
                <dd>{companySponsorTierDetails.SPONSOR.description}</dd>
            </div>
        </dl>
    )
}
