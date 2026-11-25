'use client'
import useDomainContext from '@/hooks/useDomainContext'
import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { AppNavLink } from '@/lib/navDef/navDef'

type PropTypes = {
    /** The items of `companyNavDef` the session may open. */
    links: AppNavLink[],
}

/** The tabs of a company's page. The first is the company's own page, which the others sit under. */
export default function CompanyTabs({ links }: PropTypes) {
    const { path } = useDomainContext()
    const [overview] = links
    const isOnPage = (href: AppNavLink['href']) => (
        href === overview.href ? path === href : path === href || path.startsWith(`${href}/`)
    )

    return (
        <nav className="flex flex-wrap gap-x-8 gap-y-2 border-b border-careers-line" aria-label="Bedriftens sider">
            {links.map(link => (
                <SiteLink
                    key={link.key}
                    href={link.href}
                    aria-current={path === link.href ? 'page' : undefined}
                    className={`
                        -mb-px flex items-center gap-2 py-3 border-b-2 text-m font-semibold no-underline transition-colors
                        duration-300
                        hover:text-careers-accent hover:no-underline
                        [&_svg]:size-[0.9em] [&_svg]:text-inherit
                        ${isOnPage(link.href)
                    ? 'border-careers-accent text-careers-navy'
                    : 'border-transparent text-base-content/80'}
                    `}
                >
                    <FontAwesomeIcon icon={link.icon} />
                    {link.name}
                </SiteLink>
            ))}
        </nav>
    )
}
