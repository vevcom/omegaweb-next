import { companySponsorTierDetails } from '@/services/careers/companies/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCrown, faStar } from '@fortawesome/free-solid-svg-icons'
import type { CompanySponsorTier } from '@/prisma-generated-pn-types'

const sponsorTierIcon = {
    MAIN: faCrown,
    SPONSOR: faStar,
} as const

const sponsorTierClass = {
    MAIN: `text-primary-content border-primary bg-primary`,
    SPONSOR: `text-primary border-primary bg-base-200`,
} as const

type PropTypes = {
    sponsorTier: CompanySponsorTier,
    iconOnly?: boolean,
    className?: string,
}

export default function SponsorBadge({ sponsorTier, iconOnly = false, className }: PropTypes) {
    if (sponsorTier === 'NONE') return <></>

    const { label, description } = companySponsorTierDetails[sponsorTier]

    return (
        <span
            className={`
                inline-flex items-center gap-2.5 py-1 px-3 rounded-full border text-[length:calc(var(--text-s)*0.9)]
                font-medium leading-[1.4] whitespace-nowrap
                [&_svg]:size-[0.9em] [&_svg]:shrink-0
                ${sponsorTierClass[sponsorTier]}
                ${className ?? ''}
            `}
            title={`${label} — ${description}`}
        >
            <FontAwesomeIcon icon={sponsorTierIcon[sponsorTier]} className={`${sponsorTierClass[sponsorTier]}`} aria-hidden />
            <span className={iconOnly ? 'sr-only' : 'overflow-hidden text-ellipsis'}>{label}</span>
        </span>
    )
}
