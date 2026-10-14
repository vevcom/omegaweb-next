import styles from './OmbulRow.module.scss'
import Image from '@/components/Image/Image'
import Link from 'next/link'
import type { ExpandedOmbul } from '@/services/ombul/types'

type PropTypes = {
    ombul: ExpandedOmbul
}

/**
 * A compact list-row rendering of an ombul issue, for listings that lay their
 * items out as rows rather than as covers. The cover grid uses OmbulCover.
 * @param ombul - The ombul issue to display
 */
export default function OmbulRow({ ombul }: PropTypes) {
    return (
        <Link href={`/ombul/${ombul.year}/${ombul.name}`} className={styles.OmbulRow}>
            <div className={styles.thumb}>
                <Image
                    disableLinkingToLicense
                    creditPlacement="top"
                    width={200}
                    image={ombul.coverImage}
                />
            </div>

            <div className={styles.lead}>
                <b>{ombul.issueNumber}</b>
                <span>utgave</span>
            </div>

            <div className={styles.main}>
                <h2>{ombul.name}</h2>
                <p>{ombul.description}</p>
            </div>

            <div className={styles.meta}>
                <span>{ombul.year}</span>
            </div>
        </Link>
    )
}
