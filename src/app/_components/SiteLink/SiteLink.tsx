'use client'
import useDomainContext from '@/hooks/useDomainContext'
import Link from 'next/link'
import type { AppHref, ExternalHref } from '@/lib/sites/href'
import type { ComponentProps } from 'react'

type PropTypes = Omit<ComponentProps<typeof Link>, 'href'> & {
    /** A page of the app, from a link object, or a url outside it. Never one already resolved for the domain. */
    href: AppHref | ExternalHref,
    /** Go by the main domain of the page's site even from a domain that serves it: the explicit way over to another site. */
    toMainDomainServingSite?: boolean,
}

/**
 * A link to a page of the app, rendered for the domain the visitor is on: site-relative on the
 * page's own domain, by the site's main domain from another site's domain. Every link in the app
 * goes through it, so `next/link` is imported here alone; anything but an app path passes through
 * as it is.
 */
export default function SiteLink({ href, toMainDomainServingSite, ...props }: PropTypes) {
    const context = useDomainContext()
    return <Link href={context.resolveHref(href, { toMainDomainServingSite })} {...props} />
}
