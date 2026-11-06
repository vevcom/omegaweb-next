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
        // Not a link, so the hover affordance list-row gives clickable listings is cancelled.
        <div className="
            list-row
            hover:bg-base-200!
        ">
            <div className="list-row-lead text-base-content/80 text-l">
                <FontAwesomeIcon icon={faQuoteLeft} className="text-primary [&_path]:text-inherit" />
            </div>

            <div className="list-row-main">
                <h2 className="whitespace-normal! font-secondary italic line-clamp-2">{quote.quote}</h2>
                <p>{quote.author}</p>
            </div>

            <div className="list-row-meta">
                <span><Date date={quote.timestamp} includeTime={false} /></span>
            </div>
        </div>
    )
}
