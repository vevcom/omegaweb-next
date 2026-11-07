declare const hrefKind: unique symbol

/**
 * The hrefs of the app come in three kinds, told apart by their type, so that an href is never
 * resolved for a domain twice or not at all. A link object builds an AppHref; the domain context
 * resolves it into what the browser follows; SiteLink, useSiteRouter and siteRedirect do that
 * resolving, so they take only what is not resolved yet. A string becomes one of the kinds through
 * the functions below alone, which is where every cast to them lives.
 */

/** A path as the app routes it, from the app's root: `/career/job-ads`. What the link objects build. */
export type AppHref = string & { readonly [hrefKind]: 'app' }

/** A url that is not a page of the app, followed as it is: `https://`, `mailto:`, `tel:` or `#anchor`. */
export type ExternalHref = string & { readonly [hrefKind]: 'external' }

/**
 * An href as the browser on the domain the visitor is on follows it, which is what a DomainContext
 * resolves an AppHref into: site-relative on the page's own domain, by a domain for another site.
 * What NextAuth and window.location are given; never what SiteLink is given, which resolves.
 */
export type DomainContextResolvedHref = string & { readonly [hrefKind]: 'resolved' }

export function isAppPath(href: string): href is AppHref {
    return href.startsWith('/') && !href.startsWith('//')
}

/** A path the app routes, written by hand where no link object builds it. Throws on anything else. */
export function appHref(path: string): AppHref {
    if (!isAppPath(path)) throw new Error(`Not a path of the app: ${path}`)
    return path
}

/** A url outside the app's pages, followed as it is. Throws on a path, which is the app's. */
export function externalHref(url: string): ExternalHref {
    if (isAppPath(url)) throw new Error(`A path is the app's own, not external: ${url}`)
    return url as ExternalHref
}

/**
 * An href from data, such as a CMS link or a stored notification url, sorted by its shape: a path is
 * the app's, anything else is followed as it is.
 */
export function hrefOf(value: string): AppHref | ExternalHref {
    return isAppPath(value) ? value : externalHref(value)
}

/**
 * Marks an href as resolved for the domain the visitor is on. Resolving is DomainContext's job and
 * the result is final, so only DomainContext.resolveHref may call this, which eslint enforces.
 */
export function domainContextResolvedHref(href: string): DomainContextResolvedHref {
    return href as DomainContextResolvedHref
}
