import styles from './SponsorBadge.module.scss'
import { companySponsorTierDetails } from '@/services/career/companies/constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCrown, faStar } from '@fortawesome/free-solid-svg-icons'
import type { CompanySponsorTier } from '@/prisma-generated-pn-types'

const sponsorTierIcon = {
    MAIN: faCrown,
    SPONSOR: faStar,
} as const

const sponsorTierClass = {
    MAIN: styles.tierMain,
    SPONSOR: styles.tierSponsor,
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
            className={`${styles.SponsorBadge} ${sponsorTierClass[sponsorTier]} ${className ?? ''}`}
            title={`${label} — ${description}`}
        >
            <FontAwesomeIcon icon={sponsorTierIcon[sponsorTier]} aria-hidden />
            <span className={iconOnly ? styles.labelHidden : styles.label}>{label}</span>
        </span>
    )
}
