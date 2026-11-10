import '@pn-server-only'
import { CURRENT_PATH_HEADER, SITE_DOMAIN_HEADER } from '@/proxy'
import { DomainContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { ResolveHrefOptions, ServedOn } from '@/lib/sites/context'
import type { AppHref, DomainContextResolvedHref } from '@/lib/sites/href'
import type { NextRequest } from 'next/server'

/**
 * Where the request being rendered is, from the headers the proxy stamped, since a server component
 * cannot read its own url. Once per request.
 */
export const domainContextOfRequest = cache(async (): Promise<DomainContext> => {
    loadDomainConfig()
    const requestHeaders = await headers()
    const domain = requestHeaders.get(SITE_DOMAIN_HEADER) ?? requestHeaders.get('host') ?? ''
    return DomainContext.fromAppPath(domain, requestHeaders.get(CURRENT_PATH_HEADER) ?? '/')
})

/**
 * Where a route handler's request is, from the headers the proxy stamped on it. The same as
 * {@link domainContextOfRequest}, for code that has the request in hand rather than the render.
 */
export function domainContextOf(request: NextRequest): DomainContext {
    loadDomainConfig()
    const domain = request.headers.get(SITE_DOMAIN_HEADER) ?? request.headers.get('host') ?? request.nextUrl.host
    const path = request.headers.get(CURRENT_PATH_HEADER) ?? `${request.nextUrl.pathname}${request.nextUrl.search}`
    return DomainContext.fromAppPath(domain, path)
}

/**
 * The url a route handler sends its request on to for an app path: resolved for the domain the
 * request came to, and absolute on that domain. The request's own url is no base for it, since
 * Next writes the host it listens on there and not the one the browser asked for.
 */
export function redirectUrlFor(request: NextRequest, href: AppHref, options?: ResolveHrefOptions): URL {
    const context = domainContextOf(request)
    return new URL(context.resolveHref(href, options), context.origin() ?? request.nextUrl)
}

/** An app path as the request being rendered should link or redirect to it, see {@link DomainContext.resolveHref}. */
export async function siteHref(href: AppHref, options?: ResolveHrefOptions): Promise<DomainContextResolvedHref> {
    return (await domainContextOfRequest()).resolveHref(href, options)
}

/** Sends the request on to an app path, where it is for the domain the request came to. Throws, as Next's redirect does. */
export async function siteRedirect(href: AppHref, options?: ResolveHrefOptions): Promise<never> {
    redirect(await siteHref(href, options))
}

/**
 * Sends the request being rendered on to the domain that serves its page, with the same path and
 * query, when that is not the domain it came to, see {@link DomainContext.urlOnServingDomain}.
 * `servedOn` is what the page says of itself.
 */
export async function redirectToServingDomain(servedOn?: ServedOn): Promise<void> {
    const url = (await domainContextOfRequest()).urlOnServingDomain(servedOn)
    if (url) redirect(url)
}
