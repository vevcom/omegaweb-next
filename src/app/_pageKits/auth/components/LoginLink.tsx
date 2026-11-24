'use client'
import useDomainContext from '@/hooks/useDomainContext'
import { authLinks } from '@/pageKits/auth/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { ReactNode } from 'react'

type PropTypes = {
    config: AuthPagesConfig,
    className?: string,
    children?: ReactNode,
}

/** The login of a site in its navigation, coming back to the page it sits on. */
export default function LoginLink({ config, className, children = 'Logg inn' }: PropTypes) {
    const { path } = useDomainContext()
    return <SiteLink href={authLinks(config).login({ callbackUrl: path })} className={className}>{children}</SiteLink>
}
