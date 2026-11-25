import RevueMobileMenu from './RevueMobileMenu'
import RevueWordmark from './RevueWordmark'
import { revueLinks } from '@/app/(revue)/links'
import { revueAdminLinks } from '@/app/(revue)/revue/(static-theme)/admin/links'
import { revueAuthPages } from '@/app/(revue)/revue/(static-theme)/(auth)/config'
import { revueAuthLinks } from '@/app/(revue)/revue/(static-theme)/(auth)/links'
import { innerClassName } from '@/app/(revue)/_lib/revueClassNames'
import { omegaLinks } from '@/app/(omegaweb)/links'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import LoginLink from '@/pageKits/auth/components/LoginLink'
import SiteLink from '@/components/SiteLink/SiteLink'

type PropTypes = {
    /** The signed in user's, null for anyone else. */
    username: string | null,
    /** Whether the session has an admin page to open, which is when the admin link is shown. */
    hasAdminPages: boolean,
}

const focusClassName = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent'

const linkClassName = `
    text-m font-medium text-base-content/80 whitespace-nowrap transition-colors
    hover:text-accent hover:no-underline
    ${focusClassName}
`

const loginButtonClassName = `
    inline-flex items-center h-10 px-5 rounded-full border border-accent/60 text-m font-medium text-accent
    whitespace-nowrap transition-colors
    hover:bg-accent hover:text-accent-content hover:no-underline
    ${focusClassName}
`

const mobileItemClassName = `
    px-(--revue-page-padding) py-4 text-l font-medium text-base-content transition-colors
    not-first:border-t not-first:border-base-300
    hover:bg-base-300 hover:text-accent hover:no-underline
    focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent
`

/**
 * The revue site's header: the wordmark, then the admin, the way over to Omega's site and the login or
 * logout. On narrow screens the links go in a menu. The edit mode switch renders nothing for those who
 * have nothing to edit.
 */
export default function RevueNavBar({ username, hasAdminPages }: PropTypes) {
    return (
        <header className="sticky top-[env(safe-area-inset-top)] z-3 bg-base-100 border-b border-accent/25">
            <nav className={`
                ${innerClassName}
                h-16 flex items-center gap-6
                max-mobile:gap-2
            `}>
                <SiteLink
                    href={revueLinks.frontpage()}
                    className={`
                        mr-auto no-underline
                        hover:no-underline
                        ${focusClassName}
                    `}
                    aria-label="Omegarevyen, til forsiden"
                >
                    <RevueWordmark />
                </SiteLink>
                <div className="
                    flex items-center gap-8
                    max-mobile:hidden
                ">
                    <RevueLinks
                        username={username}
                        hasAdminPages={hasAdminPages}
                        className={linkClassName}
                        loginClassName={loginButtonClassName}
                    />
                </div>
                <div className="
                    size-[40px]
                    empty:hidden
                ">
                    <EditModeSwitch />
                </div>
                <RevueMobileMenu>
                    <RevueLinks username={username} hasAdminPages={hasAdminPages} className={mobileItemClassName} />
                </RevueMobileMenu>
            </nav>
        </header>
    )
}

function RevueLinks({ username, hasAdminPages, className, loginClassName = className }: PropTypes & {
    className: string,
    loginClassName?: string,
}) {
    return (
        <>
            {hasAdminPages && <SiteLink href={revueAdminLinks.frontpage()} className={className}>
                Administrasjon
            </SiteLink>}
            <SiteLink href={omegaLinks.frontpage()} toMainDomainServingSite className={className}>
                Til Omegaveven
            </SiteLink>
            {username ? <>
                <SiteLink href={revueLinks.user({ username })} className={className}>Min profil</SiteLink>
                <SiteLink href={revueAuthLinks.logout()} className={className}>Logg ut</SiteLink>
            </> : <LoginLink config={revueAuthPages} className={loginClassName} />}
        </>
    )
}
