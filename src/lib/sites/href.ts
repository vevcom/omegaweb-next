import { ROOT_SITE, pathOnSite, siteOfPath } from './sites'
import type { Site } from './sites'

/**
 * What rendering a link needs to know about the visitor: the site of the host they are on, and
 * where each site is reached.
 */
export type SiteContext = {
    site: Site,
    mainOrigins: Record<Site, string | null>,
}

export type ResolveHrefOptions = {
    /** Reach the page by its site's main domain even where a path would do: the explicit way over to another site. */
    viaDomain?: boolean,
}

const isAppPath = (href: string) => href.startsWith('/') && !href.startsWith('//')

/**
 * The href to render for an app path such as `/career/job-ads`, given where the visitor is. On the
 * page's own site the path is site-relative. From an Omega domain another site sits under its base
 * path. From another site's domain the page is reached by its site's main domain, or by Omega's main
 * domain with the base path when its site has none. Anything but an app path is left as it is.
 */
export function resolveHref(href: string, context: SiteContext, options: ResolveHrefOptions = {}): string {
    if (!isAppPath(href)) return href
    const target = siteOfPath(href)
    const onTarget = pathOnSite(target, href)
    const targetOrigin = context.mainOrigins[target]
    if (options.viaDomain && targetOrigin) return `${targetOrigin}${onTarget}`
    if (target === context.site) return onTarget
    if (context.site === ROOT_SITE) return href
    if (targetOrigin) return `${targetOrigin}${onTarget}`
    const rootOrigin = context.mainOrigins[ROOT_SITE]
    return rootOrigin ? `${rootOrigin}${href}` : href
}
