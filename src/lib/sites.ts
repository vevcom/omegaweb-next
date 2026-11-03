import { z } from 'zod'

export const siteSchema = z.enum(['OMEGAWEB', 'CAREERS'])
export type Site = z.infer<typeof siteSchema>

/** The two sites this app serves: Omega's own at the root, and the career site under its base path. */
export const sites = {
    OMEGAWEB: { basePath: '' },
    CAREERS: { basePath: '/career' },
} as const satisfies Record<Site, { basePath: string }>

export function siteOfPath(path: string): Site {
    const careerBase = sites.CAREERS.basePath
    return path === careerBase || path.startsWith(`${careerBase}/`) || path.startsWith(`${careerBase}?`)
        ? 'CAREERS'
        : 'OMEGAWEB'
}

/**
 * Where a site is reached from outside, for links in emails and notifications. The career site gets
 * its own origin here once contactor.no proxies to it.
 */
export function siteUrl(site: Site): string {
    return `${process.env.WEBSITE_URL}${sites[site].basePath}`
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
