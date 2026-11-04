import { Site, siteNameSchema } from './site'
import { z } from 'zod'
import type { SiteName } from './site'

const domainSchema = z.object({
    site: siteNameSchema,
    /** The domain the site is linked by from the other sites. A site with domains has exactly one. */
    main: z.boolean().default(false),
    protocol: z.enum(['https', 'http']).default('https'),
})

const fileSchema = z.record(
    z.string().regex(/^[a-z0-9.-]+(:\d+)?$/i, 'A host name, with its port when it is not the default'),
    domainSchema,
).superRefine((entries, ctx) => {
    Site.all.forEach(site => {
        const ofSite = Object.values(entries).filter(entry => entry.site === site.name)
        const mains = ofSite.filter(entry => entry.main).length
        if (ofSite.length > 0 && mains !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${site.name} has ${mains} domains marked main; a site with domains has exactly one`,
            })
        }
    })
})

export type SiteDomain = {
    host: string,
    site: SiteName,
    main: boolean,
    origin: string,
}

/**
 * The domains of the sites, as sites.json declares them. Internal to {@link DomainContext}, which is
 * configured with the one in use and answers every question about hosts and sites from it.
 */
export class DomainConfig {
    private constructor(readonly domains: readonly SiteDomain[]) {}

    /** The config as the file has it. Throws on a file that does not fit. */
    static parse(json: unknown): DomainConfig {
        const entries = fileSchema.parse(json)
        return new DomainConfig(Object.entries(entries).map(([host, entry]) => ({
            host: host.toLowerCase(),
            site: entry.site,
            main: entry.main,
            origin: `${entry.protocol}://${host.toLowerCase()}`,
        })))
    }

    /** The config as {@link toJSON} serialised it, for the browser. */
    static fromJSON(domains: SiteDomain[]): DomainConfig {
        return new DomainConfig(domains)
    }

    toJSON(): SiteDomain[] {
        return [...this.domains]
    }

    /** The domain a host is, or null for a host that is not configured. */
    domainOfHost(host: string): SiteDomain | null {
        return this.domains.find(domain => domain.host === host.toLowerCase()) ?? null
    }

    /** The host names of the domains, without their ports, as the dev server takes them in allowedDevOrigins. */
    hostNames(): string[] {
        const hostNames = this.domains.map(domain => new URL(domain.origin).hostname)
        return hostNames.filter((hostName, index) => hostNames.indexOf(hostName) === index)
    }

    originsOfSite(site: Site): string[] {
        return this.domains.filter(domain => domain.site === site.name).map(domain => domain.origin)
    }

    /** Where a site is linked by from the other sites, or null for a site without domains. */
    mainOriginOfSite(site: Site): string | null {
        return this.domains.find(domain => domain.site === site.name && domain.main)?.origin ?? null
    }
}
