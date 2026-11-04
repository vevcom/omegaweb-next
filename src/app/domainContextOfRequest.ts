import '@pn-server-only'
import { CURRENT_PATH_HEADER, SITE_DOMAIN_HEADER } from '@/proxy'
import { DomainContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { ResolveHrefOptions } from '@/lib/sites/context'
import type { AppHref, DomainContextResolvedHref } from '@/lib/sites/href'

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

/** An app path as the request being rendered should link or redirect to it, see {@link DomainContext.resolveHref}. */
export async function siteHref(href: AppHref, options?: ResolveHrefOptions): Promise<DomainContextResolvedHref> {
    return (await domainContextOfRequest()).resolveHref(href, options)
}

/** Sends the request on to an app path, where it is for the domain the request came to. Throws, as Next's redirect does. */
export async function siteRedirect(href: AppHref, options?: ResolveHrefOptions): Promise<never> {
    redirect(await siteHref(href, options))
}
