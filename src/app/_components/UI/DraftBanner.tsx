import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import type { ReactNode } from 'react'

/** Across the top of a page that is not published, which only those who administrate it get to see. */
export default function DraftBanner({ children }: { children: ReactNode }) {
    return <div
        role="status"
        className="
            flex items-center gap-3 px-4 py-3 rounded-round border-2 border-accent-orange bg-surface-base font-medium
            [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-accent-orange
        "
    >
        <FontAwesomeIcon icon={faEyeSlash} />
        <span>{children}</span>
    </div>
}
