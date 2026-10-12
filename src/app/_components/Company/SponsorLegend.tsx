import styles from './SponsorLegend.module.scss'
import SponsorBadge from './SponsorBadge'
import { companySponsorTierDetails } from '@/services/career/companies/constants'

export default function SponsorLegend() {
    return (
        <dl className={styles.SponsorLegend}>
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
