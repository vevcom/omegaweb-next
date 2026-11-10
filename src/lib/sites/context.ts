import { Site } from './site'
import { appHref, domainContextResolvedHref, isAppPath } from './href'
import type { DomainConfig, DomainConfigData, SiteDomain } from './domainConfig'
import type { AppHref, DomainContextResolvedHref, ExternalHref } from './href'

export type DomainContextData = {
    domain: string,
    path: AppHref,
}

/**
 * Where a page says it is served, when that is not on its site: on the auth domain, the one domain
 * that signs users in, where its session lives and credentials are typed.
 */
export type ServedOn = 'auth-domain'

export type ResolveHrefOptions = {
    /**
     * Go by the main domain of the page's site even from a domain that serves it: the explicit way over
     * to another site, used sparingly. Without it the visitor stays on the domain they are on when it can.
     */
    toMainDomainServingSite?: boolean,
}

const appWidePrefixes = ['/api/', '/_next/', '/__nextjs', '/store/', '/.well-known/']
// A file at the app's root, such as /sw.js, /manifest.webmanifest or an icon: a page never has an extension.
const rootFile = /^\/[^/?#]+\.[a-z0-9]+(?:[?#]|$)/i

/**
 * Paths that are the app's rather than a site's: served alike on every domain, never under a base
 * path. The api, Next's own files, the store, the well-known documents and the files at the root,
 * which the browser asks for by their plain path on every domain.
 */
export const isAppWidePath = (path: string) =>
    appWidePrefixes.some(prefix => path.startsWith(prefix)) || rootFile.test(path)

// On globalThis rather than in module state: the proxy, instrumentation and the routes are bundled
// apart on the server, each with its own copy of this module, but share the process.
const store = globalThis as { domainConfig?: DomainConfig }

/**
 * Where a request or a visitor is: on which domain, looking at which page. It holds only those two
 * facts and infers the rest, such as the site, from them and from the domain config it is
 * configured with, so being on contactor.no and being on omega.ntnu.no/career are different
 * contexts for the same page. Everything site-aware works through it rather than looking at the
 * url itself.
 *
 * One domain signs users in, the auth domain, see {@link isAuthDomain}. A page says itself when it
 * is served there, see {@link ServedOn}, and is then served there alone, under the base path of
 * the site it is mounted on. A domain set apart for it serves no other page. The context never
 * tells such a page from its path: {@link urlOnServingDomain} sends a request on from what the
 * page says. Each site's domain still holds its own session cookie, which the sign in hands over
 * to it.
 *
 * The server configures it once at start, from sites.json (see loadDomainConfig); the browser from
 * what the server hands over.
 */
export class DomainContext {
    private constructor(
        /** The host the browser is on, as it sent it: the domain name, with the port when it is not the default. */
        readonly domain: string,
        /** The page as the app routes it: with the base path of its site, and the query. */
        readonly path: AppHref,
    ) {}

    static configure(config: DomainConfig): void {
        store.domainConfig = config
    }

    static isConfigured(): boolean {
        return store.domainConfig !== undefined
    }

    /** The domain a host is, or null for a host that is no site's, such as the auth domain. */
    static domainOfHost(host: string): SiteDomain | null {
        return DomainContext.config().domainOfHost(host)
    }

    /** The domain a host is an alias of, such as `www.omega.ntnu.no` of `omega.ntnu.no`, or null for no alias. */
    static domainOfAlias(host: string): SiteDomain | null {
        return DomainContext.config().domainOfAlias(host)
    }

    /** The host names of the configured domains, without ports, such as `contactor.no`. */
    static hostNames(): string[] {
        return DomainContext.config().hostNames()
    }

    /** The config in use, for the server to hand over to the browser. */
    static configForBrowser(): DomainConfigData {
        return DomainContext.config().toJSON()
    }

    /** Whether sites.json names any domain. Until it does, as at build, every host is served like Omega's. */
    static hasDomains(): boolean {
        return DomainContext.config().hasDomains()
    }

    /**
     * The origin that signs users in: the dedicated auth domain, or without one the main domain of
     * Omega's site. Throws without either, since no one logs in then.
     */
    static authOrigin(): string {
        const origin = DomainContext.config().authOrigin()
        if (!origin) throw new Error('sites.json gives no auth domain and Omega\'s site no main domain to sign in on')
        return origin
    }

    private static config(): DomainConfig {
        if (!store.domainConfig) throw new Error('DomainContext is not configured with the site domains')
        return store.domainConfig
    }

    /**
     * From what the browser asked for: its host, and the path as the browser sees it, which is
     * site-relative on a site's own domain, so `/job-ads` on contactor.no is the app's `/career/job-ads`.
     */
    static fromBrowser(domain: string, browserPath: string): DomainContext {
        const siteDomain = DomainContext.config().domainOfHost(domain)
        const hostSite = siteDomain ? Site.of(siteDomain.site) : Site.root
        const rest = browserPath === '/' ? '' : browserPath.replace(/^\/(?=[?#])/, '')
        return new DomainContext(domain, appHref(hostSite.isRoot ? browserPath : hostSite.pagesPath(rest)))
    }

    /** From the host and a path the app already routes, as the server gets them from the proxy's headers. */
    static fromAppPath(domain: string, path: string): DomainContext {
        return new DomainContext(domain, appHref(path))
    }

    static fromData(data: DomainContextData): DomainContext {
        return new DomainContext(data.domain, data.path)
    }

    /**
     * An href of a page on `site` as a link from outside the app, in emails and notifications: by the
     * main domain serving it. A page served on the auth domain is linked by {@link authDomainUrl}.
     */
    static publicUrl(site: Site, href: AppHref): string {
        const url = DomainContext.mainDomainUrl(site, href)
        if (!url) throw new Error('sites.json gives Omega\'s site no main domain to link by')
        return url
    }

    /**
     * The url of an app path on the auth domain, which serves every site under its base path. For
     * what must go straight there: the redirects to the login form and the links in the sign up
     * and password emails, whose tokens then never pass a site's domain. Throws without an auth
     * domain, as {@link authOrigin} does.
     */
    static authDomainUrl(href: AppHref): string {
        return `${DomainContext.authOrigin()}${href}`
    }

    /**
     * The origin a site is reached by from outside: its main domain, or Omega's for a site without
     * domains. Throws without either, as nothing is reached then.
     */
    static originOfSite(site: Site): string {
        const config = DomainContext.config()
        const origin = config.mainOriginOfSite(site) ?? config.mainOriginOfSite(Site.root)
        if (!origin) throw new Error('sites.json gives Omega\'s site no main domain to reach it by')
        return origin
    }

    /**
     * The domain a site's own mail addresses are on, such as noreply@: the host name of its main
     * domain, or of Omega's for a site without domains. Omega's own addresses, such as hs@, are on
     * `mailDomainOf(Site.root)`.
     */
    static mailDomainOf(site: Site): string {
        const config = DomainContext.config()
        const origin = config.mainOriginOfSite(site) ?? config.mainOriginOfSite(Site.root)
        if (!origin) throw new Error('sites.json gives Omega\'s site no main domain for its mail addresses')
        return new URL(origin).hostname
    }

    /**
     * The url of a page on `site` by the main domain serving it: the site's own, or Omega's with the
     * base path when the site has no domain. Null when neither has one.
     */
    private static mainDomainUrl(site: Site, href: AppHref): string | null {
        const config = DomainContext.config()
        const origin = config.mainOriginOfSite(site)
        if (origin) return `${origin}${site.pathOn(href)}`
        const rootOrigin = config.mainOriginOfSite(Site.root)
        return rootOrigin ? `${rootOrigin}${href}` : null
    }

    toData(): DomainContextData {
        return { domain: this.domain, path: this.path }
    }

    /** The same visitor on another page of the app. */
    withPath(path: AppHref): DomainContext {
        return new DomainContext(this.domain, path)
    }

    /** The configured domain the visitor is on, or null on a host that is not configured. */
    siteDomain(): SiteDomain | null {
        return DomainContext.config().domainOfHost(this.domain)
    }

    /**
     * Whether the visitor is on the domain that signs users in, where the session the auth pages work
     * on lives: the dedicated auth domain, or without one the main domain of Omega's site.
     */
    isAuthDomain(): boolean {
        const origin = this.dedicatedAuthOrigin() ?? this.siteDomain()?.origin ?? null
        return origin !== null && origin === DomainContext.config().authOrigin()
    }

    /**
     * Whether the visitor is on a domain set apart to sign users in, which serves the pages that say
     * they are served on the auth domain, under their sites' base paths, and no other page.
     */
    isDedicatedAuthDomain(): boolean {
        return this.dedicatedAuthOrigin() !== null
    }

    private dedicatedAuthOrigin(): string | null {
        const config = DomainContext.config()
        return config.isAuthHost(this.domain) ? config.authOrigin() : null
    }

    /**
     * The site whose domain the visitor is on. The root site on a host that is not configured, and
     * on the dedicated auth domain, since such a host, like the root site's own domains, serves
     * every site under its base path.
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
     * page is reached by the main domain serving it, which is every page from a domain set apart to
     * sign users in. A page served on the auth domain resolves like any page of its site, and the
     * page itself sends the request on, see {@link urlOnServingDomain}. Anything but a site's page,
     * such as an external url or an app-wide path like `/api/...`, is left as it is. The result is
     * typed as resolved, so it is never resolved again: on another site's domain a site-relative
     * path reads as a page of Omega's.
     */
    resolveHref(href: AppHref | ExternalHref, options: ResolveHrefOptions = {}): DomainContextResolvedHref {
        const resolved = (): string => {
            if (!isAppPath(href) || isAppWidePath(href)) return href
            const target = Site.ofPath(href)
            if (!options.toMainDomainServingSite && this.serves(target)) {
                return this.servesBasePaths() ? href : target.pathOn(href)
            }
            return DomainContext.mainDomainUrl(target, href) ?? href
        }
        return domainContextResolvedHref(resolved())
    }

    /**
     * Whether the domain the visitor is on serves the pages of `site`: its own site, or any site on
     * Omega's domains. The dedicated auth domain serves no site's pages, only the pages that say
     * they are served on the auth domain.
     */
    serves(site: Site): boolean {
        if (this.isDedicatedAuthDomain()) return false
        return this.servesBasePaths() || this.hostSite() === site
    }

    /**
     * The url of the page the visitor asked for on the domain that serves it, with its query, or
     * null when the domain they are on does. `servedOn` is what the page says of itself: a page
     * served on the auth domain is served there alone, and any other page everywhere but on a
     * domain set apart to sign users in, from which it goes to the main domain serving its site.
     * Without an auth domain, as at build, every page is served where it is asked for.
     */
    urlOnServingDomain(servedOn?: ServedOn): string | null {
        if (servedOn === 'auth-domain') {
            const authOrigin = DomainContext.config().authOrigin()
            return authOrigin === null || this.isAuthDomain() ? null : `${authOrigin}${this.path}`
        }
        if (!this.isDedicatedAuthDomain() || isAppWidePath(this.path)) return null
        return DomainContext.mainDomainUrl(Site.ofPath(this.path), this.path)
    }
}
