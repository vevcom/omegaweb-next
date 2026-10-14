import styles from './OmegaquoteRow.module.scss'
import Date from '@/components/Date/Date'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuoteLeft } from '@fortawesome/free-solid-svg-icons'
import type { OmegaquoteFiltered } from '@/services/omegaquotes/types'

type PropTypes = {
    quote: OmegaquoteFiltered
}

/**
 * A compact list-row rendering of an omegaquote, for listings that lay their
 * items out as rows. The full speech-bubble rendering is OmegaquoteQuote.
 * @param quote - The quote to display
 */
export default function OmegaquoteRow({ quote }: PropTypes) {
    return (
        <div className={styles.OmegaquoteRow}>
            <div className={styles.lead}>
                <FontAwesomeIcon icon={faQuoteLeft} />
            </div>

            <div className={styles.main}>
                <h2>{quote.quote}</h2>
                <p>{quote.author}</p>
            </div>

            <div className={styles.meta}>
                <span><Date date={quote.timestamp} includeTime={false} /></span>
            </div>
        </div>
    )
}
