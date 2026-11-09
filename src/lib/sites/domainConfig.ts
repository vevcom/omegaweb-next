import { Site, siteNameSchema } from './site'
import { z } from 'zod'
import type { SiteName } from './site'

const hostSchema = z.string().regex(/^[a-z0-9.-]+(:\d+)?$/i, 'A host name, with its port when it is not the default')

const protocolSchema = z.enum(['https', 'http']).default('https')

const domainSchema = z.object({
    site: siteNameSchema,
    /** The domain the site is linked by from the other sites. A site with domains has exactly one. */
    main: z.boolean().default(false),
    protocol: protocolSchema,
    /** Hosts that are sent on to this domain, such as its `www.` variant. */
    aliases: z.array(hostSchema).default([]),
}).strict()

/** The one domain that signs users in, see {@link DomainContext.isAuthDomain}. It belongs to no site. */
const authDomainSchema = z.object({
    auth: z.literal(true),
    protocol: protocolSchema,
}).strict()

const entrySchema = z.union([authDomainSchema, domainSchema])

const fileSchema = z.record(hostSchema, entrySchema).superRefine((entries, ctx) => {
    const hosts = Object.keys(entries).map(host => host.toLowerCase())
    const siteEntries = Object.values(entries).filter(entry => 'site' in entry)
    const aliases = siteEntries.flatMap(entry => entry.aliases.map(alias => alias.toLowerCase()))
    aliases.forEach((alias, index) => {
        if (hosts.includes(alias) || aliases.indexOf(alias) !== index) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${alias} is an alias and a domain, or an alias twice; an alias is one domain's only`,
            })
        }
    })
    Site.all.forEach(site => {
        const ofSite = siteEntries.filter(entry => entry.site === site.name)
        const mains = ofSite.filter(entry => entry.main).length
        if (ofSite.length > 0 && mains !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${site.name} has ${mains} domains marked main; a site with domains has exactly one`,
            })
        }
    })
    const authDomains = Object.values(entries).filter(entry => 'auth' in entry).length
    if (authDomains > 1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${authDomains} domains are marked auth; one domain signs users in`,
        })
    }
})

export type SiteDomain = {
    host: string,
    site: SiteName,
    main: boolean,
    origin: string,
    /** Hosts that are sent on to this domain. */
    aliases: string[],
}

export type AuthDomain = {
    host: string,
    origin: string,
}

/** The config as it crosses to the browser. */
export type DomainConfigData = {
    domains: SiteDomain[],
    /** The dedicated auth domain, or null when Omega's main domain signs users in. */
    auth: AuthDomain | null,
}

/**
 * The domains of the sites, as sites.json declares them. Internal to {@link DomainContext}, which is
 * configured with the one in use and answers every question about hosts and sites from it.
 */
export class DomainConfig {
    private constructor(
        readonly domains: readonly SiteDomain[],
        /** The domain set apart to sign users in, when the file names one. */
        readonly authDomain: AuthDomain | null,
    ) {}

    /** The config as the file has it. Throws on a file that does not fit. */
    static parse(json: unknown): DomainConfig {
        const entries = Object.entries(fileSchema.parse(json)).map(([host, entry]) => [host.toLowerCase(), entry] as const)
        const domains = entries.flatMap(([host, entry]) => ('site' in entry ? [{
            host,
            site: entry.site,
            main: entry.main,
            origin: `${entry.protocol}://${host}`,
            aliases: entry.aliases.map(alias => alias.toLowerCase()),
        }] : []))
        const auth = entries.find(([, entry]) => 'auth' in entry)
        return new DomainConfig(domains, auth ? { host: auth[0], origin: `${auth[1].protocol}://${auth[0]}` } : null)
    }

    /** The config as {@link toJSON} serialised it, for the browser. */
    static fromJSON(data: DomainConfigData): DomainConfig {
        return new DomainConfig(data.domains, data.auth)
    }

    toJSON(): DomainConfigData {
        return { domains: [...this.domains], auth: this.authDomain }
    }

    /** Whether the file names any domain, which is when a host outside it is refused. */
    hasDomains(): boolean {
        return this.domains.length > 0 || this.authDomain !== null
    }

    /** The domain a host is, or null for a host that is not configured. */
    domainOfHost(host: string): SiteDomain | null {
        return this.domains.find(domain => domain.host === host.toLowerCase()) ?? null
    }

    /** The domain a host is an alias of, or null for a host that is no alias. */
    domainOfAlias(host: string): SiteDomain | null {
        return this.domains.find(domain => domain.aliases.includes(host.toLowerCase())) ?? null
    }

    /** Whether a host is the dedicated auth domain. */
    isAuthHost(host: string): boolean {
        return this.authDomain?.host === host.toLowerCase()
    }

    /**
     * The host names of the sites' domains, without their ports, which are the domains the sites' mail
     * is on. The auth domain is not among them: no mail is addressed to it.
     */
    hostNames(): string[] {
        return DomainConfig.uniqueHostNames(this.domains.map(domain => domain.origin))
    }

    /** Every host name the app answers on, without ports, as the dev server takes them in allowedDevOrigins. */
    allHostNames(): string[] {
        return DomainConfig.uniqueHostNames([
            ...this.domains.map(domain => domain.origin),
            ...(this.authDomain ? [this.authDomain.origin] : []),
        ])
    }

    private static uniqueHostNames(origins: string[]): string[] {
        const hostNames = origins.map(origin => new URL(origin).hostname)
        return hostNames.filter((hostName, index) => hostNames.indexOf(hostName) === index)
    }

    originsOfSite(site: Site): string[] {
        return this.domains.filter(domain => domain.site === site.name).map(domain => domain.origin)
    }

    /** Where a site is linked by from the other sites, or null for a site without domains. */
    mainOriginOfSite(site: Site): string | null {
        return this.domains.find(domain => domain.site === site.name && domain.main)?.origin ?? null
    }

    /**
     * The origin that signs users in: the dedicated auth domain, or without one the main domain of
     * Omega's site, which serves every site's pages. Null only without any domains, as at build.
     */
    authOrigin(): string | null {
        return this.authDomain?.origin ?? this.mainOriginOfSite(Site.root)
    }
}
