'use client'
import useDomainContext from '@/hooks/useDomainContext'
import { isAppWidePath } from '@/lib/sites/context'
import Link from 'next/link'
import type { AppHref, ExternalHref } from '@/lib/sites/href'
import type { ServedOn } from '@/lib/sites/context'
import type { ComponentProps } from 'react'

type PropTypes = Omit<ComponentProps<typeof Link>, 'href'> & {
    /** A page of the app, from a link object, or a url outside it. Never one already resolved for the domain. */
    href: AppHref | ExternalHref,
    /** Go by the main domain of the page's site even from a domain that serves it: the explicit way over to another site. */
    toMainDomainServingSite?: boolean,
    /** What the page linked to says of itself, so the link goes straight to the domain serving it. */
    servedOn?: ServedOn,
}

/** The props of `next/link` that are its router's alone and mean nothing on an anchor. */
const ROUTER_PROPS = ['prefetch', 'replace', 'scroll', 'shallow', 'passHref', 'legacyBehavior', 'onNavigate']

/**
 * A link to a page of the app, rendered for the domain the visitor is on: site-relative on the
 * page's own domain, by the site's main domain from another site's domain. Every link in the app
 * goes through it, so `next/link` is imported here alone; anything but an app path passes through
 * as it is.
 *
 * A link to an app-wide path, such as the sign in's `/api/sso/start`, is a plain anchor: it is a
 * route and no page, so Next's router has nothing to fetch for it or to load ahead, and following
 * it is a navigation of the browser's own.
 */
export default function SiteLink({ href, toMainDomainServingSite, servedOn, ...props }: PropTypes) {
    const context = useDomainContext()
    const resolved = context.resolveHref(href, { toMainDomainServingSite, servedOn })
    if (isAppWidePath(resolved)) {
        const anchorProps = Object.fromEntries(Object.entries(props).filter(([name]) => !ROUTER_PROPS.includes(name)))
        return <a href={resolved} {...anchorProps} />
    }
    return <Link href={resolved} {...props} />
}
