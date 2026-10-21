'use client'
import { dividerClassName, navIconClassName, navIconIconClassName, navIconLabelClassName } from './sideBarClassNames'
import NavTooltip from './NavTooltip'
import { adminNavItemHref } from './adminNavItemHref'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog } from '@fortawesome/free-solid-svg-icons'

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

    const adminLink = (
        <Link
            href={adminNavItemHref}
            className={navIconClassName}
            aria-label="Admin"
            aria-current={active ? 'page' : undefined}
        >
            <FontAwesomeIcon icon={faCog} className={navIconIconClassName} />
            <span className={navIconLabelClassName}>Admin</span>
        </Link>
    )

    return (
        <>
            <hr className={dividerClassName} />
            <nav className="w-full flex flex-col items-stretch shrink-0" aria-label="Adminnavigasjon">
                {expanded ? adminLink : <NavTooltip content="Admin">{adminLink}</NavTooltip>}
            </nav>
        </>
    )
}
