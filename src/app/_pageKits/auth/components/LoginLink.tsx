'use client'
import useSiteContext from '@/hooks/useSiteContext'
import { authLinks } from '@/pageKits/auth/links'
import Link from 'next/link'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

type PropTypes = {
    config: AuthPagesConfig,
    className?: string,
}

/** The login of a site in its navigation, coming back to the page it sits on. */
export default function LoginLink({ config, className }: PropTypes) {
    const context = useSiteContext()
    const href = context.resolveHref(authLinks(config).login({ callbackUrl: context.path }))
    return <Link href={href} className={className}>Logg inn</Link>
}
