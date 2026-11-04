import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import type { ExternalHref } from '@/lib/sites/href'

type PropTypes = {
    /** The site's name as the visitor knows it, such as Contactor. */
    siteName: string,
    /** Where the site still lives, until it has moved here. */
    currentSiteHref: ExternalHref,
}

/** Tells a visitor of a site still being built here where the site they came for is for now. */
export default function WorkInProgressBanner({ siteName, currentSiteHref }: PropTypes) {
    return (
        <aside
            role="note"
            className="
                flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 bg-surface-raised border-b
                border-surface-subtle text-s text-text text-center
            "
        >
            <FontAwesomeIcon icon={faTriangleExclamation} className="shrink-0 text-text-muted" />
            <span>
                Denne siden er under arbeid. {siteName} sine nåværende nettsider finner du på{' '}
                <SiteLink href={currentSiteHref} className="font-medium underline">
                    {currentSiteHref.replace(/^https?:\/\//, '')}
                </SiteLink>.
            </span>
        </aside>
    )
}
