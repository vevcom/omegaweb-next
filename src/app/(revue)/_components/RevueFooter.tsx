import RevueWordmark from './RevueWordmark'
import { revueAuthPages } from '@/app/(revue)/revue/(static-theme)/(auth)/config'
import { revueAuthLinks } from '@/app/(revue)/revue/(static-theme)/(auth)/links'
import { innerClassName } from '@/app/(revue)/_lib/revueClassNames'
import { omegaLinks } from '@/app/(omegaweb)/links'
import LoginLink from '@/pageKits/auth/components/LoginLink'
import SiteLink from '@/components/SiteLink/SiteLink'

type PropTypes = {
    loggedIn: boolean,
}

const linkClassName = `
    text-m text-base-content/80 transition-colors
    hover:text-accent hover:no-underline
    focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent
`

export default function RevueFooter({ loggedIn }: PropTypes) {
    return (
        <footer className="mt-16 bg-base-200 border-t border-accent/25">
            <div className={`
                ${innerClassName}
                flex justify-between items-start gap-10 py-12
                max-mobile:flex-col max-mobile:gap-8 max-mobile:py-10
            `}>
                <div className="flex flex-col gap-3">
                    <RevueWordmark />
                    <p className="max-w-[40ch] text-m text-base-content/80">
                        Revyen til linjeforeningen Omega ved NTNU.
                    </p>
                </div>
                <nav aria-label="Bunnmeny" className="
                    flex flex-col items-start gap-3
                    mobile:items-end
                ">
                    <SiteLink href={omegaLinks.frontpage()} toMainDomainServingSite className={linkClassName}>
                        Omegaveven
                    </SiteLink>
                    <SiteLink href={revueAuthLinks.terms()} className={linkClassName}>Vilkår og personvern</SiteLink>
                    {loggedIn
                        ? <SiteLink href={revueAuthLinks.logout()} className={linkClassName}>Logg ut</SiteLink>
                        : <LoginLink config={revueAuthPages} className={linkClassName} />}
                </nav>
            </div>
        </footer>
    )
}
