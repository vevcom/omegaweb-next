import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    href: string,
    label: string,
    icon: IconDefinition,
    /** Shows only the icon, in a square this many pixels wide, with the label as the accessible name. */
    iconOnlyScale?: number,
}

/**
 * A header item that links to another page, styled to match the pill buttons from
 * HeaderItemPopUp (e.g. AddHeaderItemPopUp's "Ny" button), or their icon-only squares.
 */
export default function HeaderItemLink({ href, label, icon, iconOnlyScale }: PropTypes) {
    if (iconOnlyScale) {
        const iconScale = Math.round(iconOnlyScale * 0.55)
        return (
            <Link
                href={href}
                aria-label={label}
                title={label}
                className="
                    grid place-items-center rounded-inner bg-surface-hover text-text no-underline
                    transition-[background-color,color] duration-300
                    hover:bg-surface-subtle hover:text-ink-strong hover:no-underline
                "
                style={{ width: iconOnlyScale, height: iconOnlyScale }}
            >
                <FontAwesomeIcon icon={icon} style={{ width: iconScale, height: iconScale }} />
            </Link>
        )
    }

    return (
        <Link href={href} className="header-pill-link pr-3.5 pl-5">
            <span>{label}</span>
            <FontAwesomeIcon icon={icon} />
        </Link>
    )
}
