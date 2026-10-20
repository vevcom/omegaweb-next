import { companySponsorTierDetails } from '@/services/career/companies/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCrown, faStar } from '@fortawesome/free-solid-svg-icons'
import type { CompanySponsorTier } from '@/prisma-generated-pn-types'

const sponsorTierIcon = {
    MAIN: faCrown,
    SPONSOR: faStar,
} as const

const sponsorTierClass = {
    MAIN: 'text-accent-yellow border-[color-mix(in_srgb,var(--accent-yellow),transparent_55%)] bg-[color-mix(in_srgb,var(--accent-yellow),var(--surface-raised)_85%)]',
    SPONSOR: 'text-accent-cyan border-[color-mix(in_srgb,var(--accent-cyan),transparent_60%)] bg-[color-mix(in_srgb,var(--accent-cyan),var(--surface-raised)_88%)]',
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
            className={[
                'inline-flex items-center gap-2.5 py-1 px-3 rounded-full border text-[length:calc(var(--text-s)*0.9)] font-medium leading-[1.4] whitespace-nowrap [&_svg]:size-[0.9em] [&_svg]:shrink-0',
                `${sponsorTierClass[sponsorTier]} ${className ?? ''}`,
            ].join(' ')}
            title={`${label} — ${description}`}
        >
            <FontAwesomeIcon icon={sponsorTierIcon[sponsorTier]} aria-hidden />
            <span className={iconOnly ? 'sr-only' : 'overflow-hidden text-ellipsis'}>{label}</span>
        </span>
    )
}
