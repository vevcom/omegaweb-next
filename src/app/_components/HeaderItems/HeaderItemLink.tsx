import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    href: string,
    label: string,
    icon: IconDefinition,
}

/**
 * A header item that links to another page, styled to match the pill buttons from
 * HeaderItemPopUp (e.g. AddHeaderItemPopUp's "Ny" button).
 */
export default function HeaderItemLink({ href, label, icon }: PropTypes) {
    return (
        <Link href={href} className="header-pill-link pr-3.5 pl-5">
            <span>{label}</span>
            <FontAwesomeIcon icon={icon} />
        </Link>
    )
}
