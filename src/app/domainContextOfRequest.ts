import '@pn-server-only'
import { CURRENT_PATH_HEADER, SITE_DOMAIN_HEADER } from '@/proxy'
import { DomainContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { ResolveHrefOptions } from '@/lib/sites/context'
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

/** An app path as the request being rendered should link or redirect to it, see {@link DomainContext.resolveHref}. */
export async function siteHref(href: AppHref, options?: ResolveHrefOptions): Promise<DomainContextResolvedHref> {
    return (await domainContextOfRequest()).resolveHref(href, options)
}

/** Sends the request on to an app path, where it is for the domain the request came to. Throws, as Next's redirect does. */
export async function siteRedirect(href: AppHref, options?: ResolveHrefOptions): Promise<never> {
    redirect(await siteHref(href, options))
}
