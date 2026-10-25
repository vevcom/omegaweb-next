'use client'
import { dividerClassName, navIconClassName, navIconIconClassName, navIconLabelClassName } from './sideBarClassNames'
import NavTooltip from './NavTooltip'
import { adminNavItemHref } from './adminNavItemHref'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTools } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    /** Whether any page of `adminNavDef` is one the session may open. */
    showAdmin: boolean
    expanded?: boolean
    /** Whether the current page is an admin page. */
    active?: boolean
}

/** Renders nothing at all, not even its divider, when there's no admin page to open. */
export default function AdminNav({ showAdmin, expanded = false, active = false }: PropTypes) {
    if (!showAdmin) return null

    return (
        <>
            <hr className={dividerClassName} />
            <nav className="w-full flex flex-col items-stretch shrink-0" aria-label="Adminnavigasjon">
                <NavTooltip content="Administrasjon" disabled={expanded}>
                    <Link
                        href={adminNavItemHref}
                        className={navIconClassName}
                        aria-label="Administrasjon"
                        aria-current={active ? 'page' : undefined}
                    >
                        <FontAwesomeIcon icon={faTools} className={navIconIconClassName} />
                        <span className={navIconLabelClassName}>Administrasjon</span>
                    </Link>
                </NavTooltip>
            </nav>
        </>
    )
}
