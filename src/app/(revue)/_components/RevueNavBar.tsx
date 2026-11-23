import RevueMobileMenu from './RevueMobileMenu'
import { revueLinks } from '@/app/(revue)/links'
import { revueAdminLinks } from '@/app/(revue)/revue/admin/links'
import { revueAuthPages } from '@/app/(revue)/revue/(auth)/config'
import { revueAuthLinks } from '@/app/(revue)/revue/(auth)/links'
import { omegaLinks } from '@/app/(omegaweb)/links'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import LoginLink from '@/pageKits/auth/components/LoginLink'
import SiteLink from '@/components/SiteLink/SiteLink'

type PropTypes = {
    loggedIn: boolean,
    /** Whether the session has an admin page to open, which is when the admin link is shown. */
    hasAdminPages: boolean,
}

const linkClassName = `
    text-m font-medium text-base-content/80
    hover:text-base-content hover:no-underline
`

const mobileItemClassName = `
    px-[clamp(1rem,4vw,3rem)] py-4 border-t border-base-300 text-m font-medium text-base-content/80
    hover:bg-base-300 hover:text-base-content hover:no-underline
`

/** The revue site's navigation: for now the wordmark, the admin, the way over to Omega's site and the login or logout. */
export default function RevueNavBar({ loggedIn, hasAdminPages }: PropTypes) {
    return (
        <header className="sticky top-0 z-3 bg-base-200 border-b border-base-300">
            <nav className="w-full max-w-[1100px] mx-auto px-[clamp(1rem,4vw,3rem)] min-h-[64px] flex items-center gap-6">
                <SiteLink href={revueLinks.frontpage()} className="
                    mr-auto text-xl font-semibold text-base-content no-underline
                ">
                    Omegarevyen
                </SiteLink>
                <div className="
                    flex items-center gap-6
                    max-mobile:hidden
                ">
                    <RevueLinks loggedIn={loggedIn} hasAdminPages={hasAdminPages} className={linkClassName} />
                </div>
                <div className="
                    size-[40px]
                    empty:hidden
                ">
                    <EditModeSwitch />
                </div>
                <RevueMobileMenu>
                    <RevueLinks loggedIn={loggedIn} hasAdminPages={hasAdminPages} className={mobileItemClassName} />
                </RevueMobileMenu>
            </nav>
        </header>
    )
}

function RevueLinks({ loggedIn, hasAdminPages, className }: PropTypes & { className: string }) {
    return (
        <>
            {hasAdminPages && <SiteLink href={revueAdminLinks.frontpage()} className={className}>
                Administrasjon
            </SiteLink>}
            <SiteLink href={omegaLinks.frontpage()} toMainDomainServingSite className={className}>
                Til Omegaveven
            </SiteLink>
            {loggedIn
                ? <SiteLink href={revueAuthLinks.logout()} className={className}>Logg ut</SiteLink>
                : <LoginLink config={revueAuthPages} className={className} />}
        </>
    )
}
