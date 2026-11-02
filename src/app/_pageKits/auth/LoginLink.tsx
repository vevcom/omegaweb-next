'use client'
import { authLinks } from './links'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { AuthPagesConfig } from './config'

type PropTypes = {
    config: AuthPagesConfig,
    className?: string,
}

/**
 * The login of a site in its navigation, coming back to the page it sits on. The navigation is on
 * every page, so the page to come back to is the one thing it reads from the url.
 */
export default function LoginLink({ config, className }: PropTypes) {
    const pathname = usePathname()
    return <Link href={authLinks(config).login(pathname)} className={className}>Logg inn</Link>
}
