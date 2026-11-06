'use client'
import useDomainContext from '@/hooks/useDomainContext'
import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { NavLink } from '@/lib/navDef/navDef'

type PropTypes = {
    /** The items of `careerAdminNavDef` the session may open. */
    links: NavLink[],
}

export default function CareerAdminSidebar({ links }: PropTypes) {
    const { path } = useDomainContext()
    const isOnPage = (href: NavLink['href']) => path === href || path.startsWith(`${href}/`)

    return (
        <nav className="flex flex-col gap-1" aria-label="Adminnavigasjon">
            {links.map(link => (
                <SiteLink
                    key={link.key}
                    href={link.href}
                    aria-current={path === link.href ? 'page' : undefined}
                    className={`
                        flex items-center gap-2 py-2 no-underline transition-colors duration-300
                        hover:text-careers-accent
                        [&_svg]:size-[0.9em] [&_svg]:text-inherit
                        ${isOnPage(link.href) ? 'text-careers-accent' : 'text-text'}
                    `}
                >
                    <FontAwesomeIcon icon={link.icon} />
                    {link.name}
                </SiteLink>
            ))}
        </nav>
    )
}
