import CareersWordmark from './CareersWordmark'
import { CareersAccountMenu, CareersMobileMenu } from './CareersNavMenus'
import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { careersAuthLinks } from '@/app/(careers)/career/(auth)/links'
import { careerLinks } from '@/app/(careers)/links'
import { omegaLinks } from '@/app/(omegaweb)/links'
import { innerClassName } from '@/app/(careers)/_lib/careersClassNames'
import { CAREERS_CONTACT_HREF } from '@/app/(careers)/_lib/careersSite'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import { CareersSearchButton } from '@/app/(careers)/GlobalSearch'
import LoginLink from '@/pageKits/auth/components/LoginLink'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { NavLink } from '@/lib/navDef/navDef'

type PropTypes = {
    links: NavLink[],
    /** What belongs to the logged in user, kept apart from the pages of the site. */
    accountLinks: NavLink[],
    loggedIn: boolean,
    /** Whether the visitor has a place on Omega's own site: a member of Omega, not den gemene hob. */
    showOmegaLink: boolean,
}

const linkClassName = `
    text-s font-medium text-careers-navy/70 whitespace-nowrap transition-colors
    hover:text-careers-accent hover:no-underline
`

const quietLinkClassName = `
    text-s font-medium text-careers-navy/60 whitespace-nowrap transition-colors
    hover:text-careers-navy hover:no-underline
`

const accountItemClassName = `
    px-3 py-2.5 text-s font-medium text-careers-navy transition-colors
    hover:bg-surface-base hover:text-careers-accent hover:no-underline
`

const mobileItemClassName = `
    px-6 py-4 border-b border-careers-navy/5 text-m font-medium text-careers-navy/80 transition-colors
    hover:bg-careers-accent/5 hover:text-careers-accent hover:no-underline
`

const loginButtonClassName = `
    inline-flex items-center h-10 px-3.5 border border-careers-navy/15 text-s font-medium text-careers-navy
    whitespace-nowrap transition-colors
    hover:bg-careers-navy/5 hover:no-underline
`

const contactClassName = `
    bg-careers-accent text-white font-medium whitespace-nowrap transition-opacity
    hover:opacity-90 hover:text-white hover:no-underline
`

/**
 * The career site's navigation: the wordmark and the pages of the site with the way to get in touch,
 * then what belongs to the visitor, which on wide screens is a dropdown once they are logged in. On
 * narrow screens it all goes in a menu. The edit mode switch is there for those who may edit the CMS
 * content of the pages, and renders nothing for everyone else.
 */
export default function CareersNavBar({ links, accountLinks, loggedIn, showOmegaLink }: PropTypes) {
    const profile = accountLinks.find(link => link.key === 'profile')

    const accountItems = (itemClassName: string) => (
        <>
            {accountLinks.map(link => (
                <SiteLink key={link.key} href={link.href} className={itemClassName}>{link.name}</SiteLink>
            ))}
            {showOmegaLink && (
                <SiteLink href={omegaLinks.frontpage()} toMainDomainServingSite className={itemClassName}>
                    Til Omegaveven
                </SiteLink>
            )}
        </>
    )

    return (
        <header className="relative z-3 bg-surface-raised border-b border-careers-line">
            <div className={`
                ${innerClassName}
                h-20 flex items-center justify-between gap-6
            `}>
                <SiteLink
                    href={careerLinks.frontpage()}
                    className="shrink-0 no-underline"
                    aria-label="Contactor, til forsiden"
                >
                    <CareersWordmark />
                </SiteLink>

                <div className="
                    hidden items-center
                    min-[1180px]:flex
                ">
                    <nav className="flex items-center gap-8" aria-label="Hovednavigasjon">
                        {links.map(link => (
                            <SiteLink key={link.key} href={link.href} className={linkClassName}>{link.name}</SiteLink>
                        ))}
                        <SiteLink href={CAREERS_CONTACT_HREF} className={`
                            ${contactClassName}
                            ml-2 px-5 py-2.5 text-s
                        `}>
                            Kontakt oss
                        </SiteLink>
                    </nav>
                    <div className="flex items-center gap-5 ml-5 pl-5 border-l border-careers-navy/10">
                        {loggedIn ? (
                            <CareersAccountMenu>
                                {accountItems(accountItemClassName)}
                                <SiteLink href={careersAuthLinks.logout()} className={accountItemClassName}>
                                    Logg ut
                                </SiteLink>
                            </CareersAccountMenu>
                        ) : (
                            <LoginLink config={careersAuthPages} className={quietLinkClassName} />
                        )}
                        <CareersSearchButton className="size-10 text-careers-navy" />
                        <div className="
                            size-10
                            empty:hidden
                        ">
                            <EditModeSwitch />
                        </div>
                    </div>
                </div>

                <div className="
                    flex items-center gap-2
                    min-[1180px]:hidden
                ">
                    {loggedIn && profile ? (
                        <SiteLink href={profile.href} className={`
                            ${loginButtonClassName}
                            max-[480px]:hidden
                        `}>
                            {profile.name}
                        </SiteLink>
                    ) : (
                        <LoginLink config={careersAuthPages} className={`
                            ${loginButtonClassName}
                            max-[380px]:hidden
                        `} />
                    )}
                    <CareersSearchButton className="size-10 text-careers-navy" />
                    <div className="
                        size-10
                        empty:hidden
                    ">
                        <EditModeSwitch />
                    </div>
                    <CareersMobileMenu>
                        {links.map(link => (
                            <SiteLink key={link.key} href={link.href} className={mobileItemClassName}>{link.name}</SiteLink>
                        ))}
                        {accountItems(mobileItemClassName)}
                        {loggedIn ? (
                            <SiteLink href={careersAuthLinks.logout()} className={mobileItemClassName}>Logg ut</SiteLink>
                        ) : (
                            <LoginLink config={careersAuthPages} className={mobileItemClassName} />
                        )}
                        <SiteLink href={CAREERS_CONTACT_HREF} className={`
                            ${contactClassName}
                            m-4 py-3 text-center text-m
                        `}>
                            Kontakt oss
                        </SiteLink>
                    </CareersMobileMenu>
                </div>
            </div>
        </header>
    )
}
