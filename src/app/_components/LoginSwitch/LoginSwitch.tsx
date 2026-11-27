'use client'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { AppHref } from '@/lib/sites/href'

type Login = 'user' | 'second'

type PropTypes = {
    names: Record<Login, string>,
    /** The login the visitor is on. */
    current: Login,
    /** The other login, carrying where the visitor was going. */
    otherHref: AppHref,
}

const tabClassName = 'py-2 border-b-2 text-center text-s'

/**
 * The way between a site's user login and its second login, at the top of both. The two logins
 * stand in the same order on either side, so it reads as one switch seen from both.
 */
export default function LoginSwitch({ names, current, otherHref }: PropTypes) {
    const logins: Login[] = ['user', 'second']
    return (
        <nav aria-label="Innlogging" className="grid grid-cols-2 mb-4">
            {logins.map(login => (login === current
                ? <span key={login} className={`
                    ${tabClassName}
                    border-primary font-semibold text-base-content
                `}>
                    {names[login]}
                    {/* Said in words, since text has no role to carry aria-current to a screen reader. */}
                    <span className="sr-only">, valgt</span>
                </span>
                : <SiteLink key={login} href={otherHref} className={`
                    ${tabClassName}
                    border-base-content/20 text-base-content/70
                    hover:border-base-content/50 hover:text-base-content hover:no-underline
                `}>{names[login]}</SiteLink>
            ))}
        </nav>
    )
}
