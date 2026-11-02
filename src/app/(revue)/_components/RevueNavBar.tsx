import { revueAuthPages, revueLinks } from '@/app/(revue)/_lib/revueSite'
import { omegaLinks } from '@/app/(omegaweb)/omegaLinks'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import LoginLink from '@/pageKits/auth/LoginLink'
import { authLinks } from '@/pageKits/auth/links'
import Link from 'next/link'

type PropTypes = {
    loggedIn: boolean,
}

const linkClassName = `
    text-m font-medium text-text-muted
    hover:text-text hover:no-underline
`

/** The revue site's navigation: for now the wordmark, the way over to Omega's site and the login or logout. */
export default function RevueNavBar({ loggedIn }: PropTypes) {
    return (
        <header className="sticky top-0 z-3 bg-surface-raised border-b border-surface-subtle">
            <nav className="w-full max-w-[1100px] mx-auto px-[clamp(1rem,4vw,3rem)] min-h-[64px] flex items-center gap-6">
                <Link href={revueLinks.frontpage()} className="mr-auto text-xl font-semibold text-text no-underline">
                    Omegarevyen
                </Link>
                <Link href={omegaLinks.frontpage()} className={linkClassName}>Til Omegaveven</Link>
                {loggedIn
                    ? <Link href={authLinks(revueAuthPages).logout()} className={linkClassName}>Logg ut</Link>
                    : <LoginLink config={revueAuthPages} className={linkClassName} />}
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
