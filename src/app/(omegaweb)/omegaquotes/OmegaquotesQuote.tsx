import styles from './OmegaquotesQuote.module.scss'
import Date from '@/components/Date/Date'
import type { OmegaquoteFiltered } from '@/services/omegaquotes/types'

export type OmegaquoteQuotePropTypes = {
    quote: OmegaquoteFiltered
}

export default function OmegaquoteQuote({ quote }: OmegaquoteQuotePropTypes) {
    return <div className={styles.OmegaquoteQuote}>
        <div className={styles.QuoteBubble}>
            <p>&quot;{ quote.quote }&quot;</p>
        </div>
        <h3>
            { quote.author }
        </h3>

        <span className={styles.timestamp}>
            <Date date={quote.timestamp} includeTime={false} />
        </span>
    </div>
}
