import CareersWordmark from './CareersWordmark'
import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { careersAuthLinks } from '@/app/(careers)/career/(auth)/links'
import { careerLinks } from '@/app/(careers)/links'
import { omegaLinks } from '@/app/(omegaweb)/links'
import { innerClassName } from '@/app/(careers)/_lib/careersClassNames'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import { CareersSearchButton } from '@/app/(careers)/GlobalSearch'
import LoginLink from '@/pageKits/auth/components/LoginLink'
import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import type { NavLink } from '@/lib/navDef/navDef'

type PropTypes = {
    links: NavLink[],
    loggedIn: boolean,
    /** Whether the visitor has a place on Omega's own site: a member of Omega, not den gemene hob. */
    showOmegaLink: boolean,
}

const linkClassName = `
    inline-flex items-center gap-2 py-2 border-b-2 border-transparent text-m font-medium transition-[border-color,color]
    duration-300
    hover:no-underline hover:border-careers-accent
`

const mutedLinkClassName = `
    ${linkClassName}
    text-text-muted
    hover:text-careers-navy
    [&_svg]:size-[0.8em] [&_svg]:text-inherit
`

/**
 * The career site's navigation: the wordmark, the links, the way over to Omega's site for its
 * members, and the login or logout. The edit mode switch is there for those who may edit the CMS
 * content of the pages - it renders nothing for everyone else.
 */
export default function CareersNavBar({ links, loggedIn, showOmegaLink }: PropTypes) {
    return (
        <header className="sticky top-0 z-3 bg-surface-raised border-b border-careers-line">
            <nav className={`
                ${innerClassName}
                min-h-[64px] flex flex-wrap items-center gap-6
                max-mobile:pb-2
            `}>
                <SiteLink
                    href={careerLinks.frontpage()}
                    className="mr-auto no-underline"
                    aria-label="Contactor, til forsiden"
                >
                    <CareersWordmark />
                </SiteLink>
                <ul className={`
                    list-none flex items-center gap-6
                    max-mobile:order-3 max-mobile:w-full max-mobile:flex-wrap max-mobile:gap-y-0
                `}>
                    {links.map(link => (
                        <li key={link.key}>
                            <SiteLink href={link.href} className={`
                                ${linkClassName}
                                text-careers-navy
                            `}>{link.name}</SiteLink>
                        </li>
                    ))}
                    <li className="
                        flex items-center gap-6 ml-4 pl-6 border-l border-careers-line
                        max-mobile:ml-0 max-mobile:pl-0 max-mobile:border-l-0
                    ">
                        {showOmegaLink && (
                            <SiteLink href={omegaLinks.frontpage()} toMainDomainServingSite className={mutedLinkClassName}>
                                <FontAwesomeIcon icon={faArrowLeft} />
                                <span>Til Omegaveven</span>
                            </SiteLink>
                        )}
                        {loggedIn
                            ? <SiteLink href={careersAuthLinks.logout()} className={mutedLinkClassName}>Logg ut</SiteLink>
                            : <LoginLink config={careersAuthPages} className={mutedLinkClassName} />}
                    </li>
                </ul>
                <CareersSearchButton className="size-[40px] text-careers-navy" />
                <div className="
                    size-[40px]
                    empty:hidden
                ">
                    <EditModeSwitch />
                </div>
            </nav>
        </header>
    )
}
