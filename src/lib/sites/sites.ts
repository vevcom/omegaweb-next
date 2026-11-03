import { z } from 'zod'

export const siteSchema = z.enum(['OMEGAWEB', 'CAREERS', 'REVUE'])
export type Site = z.infer<typeof siteSchema>

/** The sites this app serves: Omega's own at the root, and the career and revue sites under their base paths. */
export const sites = {
    OMEGAWEB: { basePath: '' },
    CAREERS: { basePath: '/career' },
    REVUE: { basePath: '/revue' },
} as const satisfies Record<Site, { basePath: string }>

/** The site at the root of the app. Its domains also serve the other sites, under their base paths. */
export const ROOT_SITE: Site = 'OMEGAWEB'

/** The site a path belongs to: the one whose base path starts it, or Omega's, which serves the rest. */
export function siteOfPath(path: string): Site {
    const site = siteSchema.options.find(candidate => {
        const base = sites[candidate].basePath
        return base !== '' && (path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`))
    })
    return site ?? ROOT_SITE
}

/** An app path of a page on `site` as the site's own domain serves it: without the site's base path. */
export function pathOnSite(site: Site, href: string): string {
    const rest = href.slice(sites[site].basePath.length)
    return rest === '' || rest.startsWith('?') || rest.startsWith('#') ? `/${rest}` : rest
}

/**
 * A set of pages served under one path of a site. A page factory's config extends this with what
 * its pages need, and each site declares its config next to its pages.
 */
export type SitePages = {
    site: Site,
    /** Where on the site the pages live, relative to the site's root. */
    path: string,
}

/** The absolute path `pages` live under. */
export function sitePagesPath(pages: SitePages): string {
    return `${sites[pages.site].basePath}${pages.path}`
}
