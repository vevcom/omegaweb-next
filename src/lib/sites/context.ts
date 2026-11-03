import { Site } from './site'
import type { DomainConfig, SiteDomain } from './domainConfig'

export type SiteContextData = {
    domain: string,
    path: string,
}

export type ResolveHrefOptions = {
    /**
     * Go by the main domain of the page's site even from a domain that serves it: the explicit way over
     * to another site, used sparingly. Without it the visitor stays on the domain they are on when it can.
     */
    toMainDomainServingSite?: boolean,
}

const isAppPath = (href: string) => href.startsWith('/') && !href.startsWith('//')

/** Paths that are the app's rather than a site's: served alike on every domain, never under a base path. */
export const isAppWidePath = (path: string) =>
    ['/api/', '/_next/', '/__nextjs', '/store/'].some(prefix => path.startsWith(prefix))

// On globalThis rather than in module state: the proxy, instrumentation and the routes are bundled
// apart on the server, each with its own copy of this module, but share the process.
const store = globalThis as { siteDomainConfig?: DomainConfig }

/**
 * Where a request or a visitor is: on which domain, looking at which page. It holds only those two
 * facts and infers the rest, such as the site, from them and from the domain config it is
 * configured with, so being on contactor.no and being on omega.ntnu.no/career are different
 * contexts for the same page. Everything site-aware works through it rather than looking at the
 * url itself.
 *
 * The server configures it once at start, from sites.json (see loadDomainConfig); the browser from
 * what the server hands over.
 */
export class SiteContext {
    private constructor(
        /** The host the browser is on, as it sent it: the domain name, with the port when it is not the default. */
        readonly domain: string,
        /** The page as the app routes it: with the base path of its site, and the query. */
        readonly path: string,
    ) {}

    static configure(config: DomainConfig): void {
        store.siteDomainConfig = config
    }

    static isConfigured(): boolean {
        return store.siteDomainConfig !== undefined
    }

    /**
     * The domain logins are shared through: Omega's main domain. Every login elsewhere is handed to
     * it, and every other domain asks it for one. Null without domains.
     */
    static sessionHubOrigin(): string | null {
        return SiteContext.config().mainOriginOfSite(Site.root)
    }

    /** Whether an origin, such as `https://contactor.no`, is one of the configured domains. */
    static isServedOrigin(origin: string): boolean {
        return SiteContext.config().hasOrigin(origin)
    }

    /** The domains in use, for the server to hand over to the browser. */
    static domainsForBrowser(): SiteDomain[] {
        return SiteContext.config().toJSON()
    }

    private static config(): DomainConfig {
        if (!store.siteDomainConfig) throw new Error('SiteContext is not configured with the site domains')
        return store.siteDomainConfig
    }

    /**
     * From what the browser asked for: its host, and the path as the browser sees it, which is
     * site-relative on a site's own domain, so `/job-ads` on contactor.no is the app's `/career/job-ads`.
     */
    static fromBrowser(domain: string, browserPath: string): SiteContext {
        const siteDomain = SiteContext.config().domainOfHost(domain)
        const hostSite = siteDomain ? Site.of(siteDomain.site) : Site.root
        const rest = browserPath === '/' ? '' : browserPath.replace(/^\/(?=[?#])/, '')
        return new SiteContext(domain, hostSite.pagesPath(rest))
    }

    /** From the host and a path the app already routes, as the server gets them from the proxy's headers. */
    static fromAppPath(domain: string, path: string): SiteContext {
        return new SiteContext(domain, path)
    }

    static fromData(data: SiteContextData): SiteContext {
        return new SiteContext(data.domain, data.path)
    }

    /**
     * An href of a page on `site` as a link from outside the app, in emails and notifications: by the
     * main domain serving it, or on WEBSITE_URL when no domains are configured.
     */
    static publicUrl(site: Site, href: string): string {
        return SiteContext.mainDomainUrl(site, href) ?? `${process.env.WEBSITE_URL}${href}`
    }

    /**
     * The url of a page on `site` by the main domain serving it: the site's own, or Omega's with the
     * base path when the site has no domain. Null when neither has one.
     */
    private static mainDomainUrl(site: Site, href: string): string | null {
        const config = SiteContext.config()
        const origin = config.mainOriginOfSite(site)
        if (origin) return `${origin}${site.pathOn(href)}`
        const rootOrigin = config.mainOriginOfSite(Site.root)
        return rootOrigin ? `${rootOrigin}${href}` : null
    }

    toData(): SiteContextData {
        return { domain: this.domain, path: this.path }
    }

    /** The same visitor on another page of the app. */
    withPath(path: string): SiteContext {
        return new SiteContext(this.domain, path)
    }

    /** The origin of the configured domain the visitor is on, or null on a host that is not configured. */
    origin(): string | null {
        return this.siteDomain()?.origin ?? null
    }

    /** The configured domain the visitor is on, or null on a host that is not configured. */
    siteDomain(): SiteDomain | null {
        return SiteContext.config().domainOfHost(this.domain)
    }

    /**
     * The site whose domain the visitor is on. The root site on a host that is not configured, since
     * such a host, like the root site's own domains, serves every site under its base path.
     */
    hostSite(): Site {
        const siteDomain = this.siteDomain()
        return siteDomain ? Site.of(siteDomain.site) : Site.root
    }

    /** Whether the host serves the other sites under their base paths. Only the root site's domains do. */
    servesBasePaths(): boolean {
        return this.hostSite().isRoot
    }

    /** The site of the page the visitor is looking at: the host's site, or on a host serving base paths, the path's. */
    site(): Site {
        return this.servesBasePaths() ? Site.ofPath(this.path) : this.hostSite()
    }

    /** The path the browser shows for the page: site-relative on a site's own domain. */
    browserPath(): string {
        return this.servesBasePaths() ? this.path : this.hostSite().pathOn(this.path)
    }

    /**
     * The href to render for an app path such as `/career/job-ads`, seen from here. The visitor stays
     * on the domain they are on whenever it serves the page's site: site-relative on the site's own
     * domains, under the base path on Omega's. Otherwise, or when asked to go to the main domain, the
     * page is reached by the main domain serving it. Anything but a site's page, such as an
     * external url or an app-wide path like `/api/...`, is left as it is.
     */
    resolveHref(href: string, options: ResolveHrefOptions = {}): string {
        if (!isAppPath(href) || isAppWidePath(href)) return href
        const target = Site.ofPath(href)
        if (!options.toMainDomainServingSite && this.serves(target)) {
            return this.servesBasePaths() ? href : target.pathOn(href)
        }
        return SiteContext.mainDomainUrl(target, href) ?? href
    }

    /** Whether the domain the visitor is on serves the pages of `site`: its own site, or any site on Omega's domains. */
    serves(site: Site): boolean {
        return this.servesBasePaths() || this.hostSite() === site
    }
}
