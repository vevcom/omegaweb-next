import styles from './Bulshit.module.scss'
import Date from '@/components/Date/Date'
import type { BulshitFiltered } from '@/services/bulshit/types'

export type BulshitPropTypes = {
    quote: BulshitFiltered
}

export default function Bulshit({ quote }: BulshitPropTypes) {
    return <div className={styles.Bulshit}>
        <div className={styles.BulshitBubble}>
            <p>&quot; Ryktes at { quote.quote }&quot;</p>
        </div>

        <span className={styles.timestamp}>
            <Date date={quote.timestamp} includeTime={false} />
        </span>
    </div>
}
