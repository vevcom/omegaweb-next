import '@pn-server-only'
import { CURRENT_PATH_HEADER, SITE_DOMAIN_HEADER } from '@/proxy'
import { SiteContext } from '@/lib/sites/context'
import { loadDomainConfig } from '@/lib/sites/loadDomainConfig'
import { headers } from 'next/headers'
import { cache } from 'react'
import type { ResolveHrefOptions } from '@/lib/sites/context'

/**
 * Where the request being rendered is, from the headers the proxy stamped, since a server component
 * cannot read its own url. Once per request.
 */
export const siteContextOfRequest = cache(async (): Promise<SiteContext> => {
    loadDomainConfig()
    const requestHeaders = await headers()
    const domain = requestHeaders.get(SITE_DOMAIN_HEADER) ?? requestHeaders.get('host') ?? ''
    return SiteContext.fromAppPath(domain, requestHeaders.get(CURRENT_PATH_HEADER) ?? '/')
})

/** An app path as the request being rendered should link or redirect to it, see {@link SiteContext.resolveHref}. */
export async function siteHref(href: string, options?: ResolveHrefOptions): Promise<string> {
    return (await siteContextOfRequest()).resolveHref(href, options)
}
