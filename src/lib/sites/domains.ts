import '@pn-server-only'
import { pathOnSite, siteSchema } from './sites'
import { isBuildPhase } from '@/lib/isBuildPhase'
import logger from '@/lib/logger'
import { z } from 'zod'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Site } from './sites'

const domainSchema = z.object({
    site: siteSchema,
    /** The domain the site is linked by from the other sites. A site with domains has exactly one. */
    main: z.boolean().default(false),
    protocol: z.enum(['https', 'http']).default('https'),
})

const fileSchema = z.record(
    z.string().regex(/^[a-z0-9.-]+(:\d+)?$/i, 'A host name, with its port when it is not the default'),
    domainSchema,
).superRefine((entries, ctx) => {
    siteSchema.options.forEach(site => {
        const ofSite = Object.values(entries).filter(entry => entry.site === site)
        const mains = ofSite.filter(entry => entry.main).length
        if (ofSite.length > 0 && mains !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${site} has ${mains} domains marked main; a site with domains has exactly one`,
            })
        }
    })
})

export type SiteDomain = {
    host: string,
    site: Site,
    main: boolean,
    origin: string,
}

/** The domains of the sites, as read from the config file. Nothing else reads the file. */
export type SiteDomains = {
    domains: readonly SiteDomain[],
    /** The site a host is a domain of, or null for a host that is not configured. */
    siteOfHost: (host: string) => Site | null,
    originsOfSite: (site: Site) => string[],
    mainOriginOfSite: (site: Site) => string | null,
    /** The main origin of each site, null for one without domains. What a visitor's site context carries. */
    mainOrigins: Record<Site, string | null>,
}

export function parseSiteDomains(json: unknown): SiteDomains {
    const entries = fileSchema.parse(json)
    const domains: SiteDomain[] = Object.entries(entries).map(([host, entry]) => ({
        host: host.toLowerCase(),
        site: entry.site,
        main: entry.main,
        origin: `${entry.protocol}://${host.toLowerCase()}`,
    }))
    const mainOrigins = Object.fromEntries(siteSchema.options.map(site => [
        site,
        domains.find(domain => domain.site === site && domain.main)?.origin ?? null,
    ])) as Record<Site, string | null>
    return {
        domains,
        siteOfHost: host => domains.find(domain => domain.host === host.toLowerCase())?.site ?? null,
        originsOfSite: site => domains.filter(domain => domain.site === site).map(domain => domain.origin),
        mainOriginOfSite: site => mainOrigins[site],
        mainOrigins,
    }
}

/** The domains in `file`, or none when there is no such file, which is how dev without a config and CI run. */
export function readSiteDomains(file: string): SiteDomains {
    if (!existsSync(file)) return parseSiteDomains({})
    return parseSiteDomains(JSON.parse(readFileSync(file, 'utf8')))
}

let loaded: SiteDomains | null = null

/** The configured domains, read once from sites.json at the app's root, or from SITES_CONFIG. */
export function siteDomains(): SiteDomains {
    if (loaded) return loaded
    const file = process.env.SITES_CONFIG ?? resolve(process.cwd(), 'sites.json')
    loaded = isBuildPhase() ? parseSiteDomains({}) : readSiteDomains(file)
    if (loaded.domains.length === 0 && !isBuildPhase()) {
        logger.warn(`No site domains configured (${file}): every host serves Omega's site, `
            + 'with the other sites under their base paths')
    }
    return loaded
}

/**
 * An href of a page on `site` as a link from outside the app, in emails and notifications: on the
 * site's main domain, or on WEBSITE_URL with the base path when the site has no domain.
 */
export function publicUrl(site: Site, href: string): string {
    const origin = siteDomains().mainOriginOfSite(site)
    return origin ? `${origin}${pathOnSite(site, href)}` : `${process.env.WEBSITE_URL}${href}`
}
