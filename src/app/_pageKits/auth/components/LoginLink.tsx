'use client'
import useSiteContext from '@/hooks/useSiteContext'
import { authLinks } from '@/pageKits/auth/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

type PropTypes = {
    config: AuthPagesConfig,
    className?: string,
}

/** The login of a site in its navigation, coming back to the page it sits on. */
export default function LoginLink({ config, className }: PropTypes) {
    const { path } = useSiteContext()
    return <SiteLink href={authLinks(config).login({ callbackUrl: path })} className={className}>Logg inn</SiteLink>
}
