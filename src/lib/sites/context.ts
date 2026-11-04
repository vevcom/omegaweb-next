import { Site } from './site'
import type { DomainConfig, SiteDomain } from './domainConfig'

export type SiteContextData = {
    domain: string,
    path: string,
}

export type ResolveHrefOptions = {
    /** Reach the page by its site's main domain even where a path would do: the explicit way over to another site. */
    viaDomain?: boolean,
}

const isAppPath = (href: string) => href.startsWith('/') && !href.startsWith('//')

let domainConfig: DomainConfig | null = null

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
        domainConfig = config
    }

    /** The domains in use, for the server to hand over to the browser. */
    static domainsForBrowser(): SiteDomain[] {
        return SiteContext.config().toJSON()
    }

    private static config(): DomainConfig {
        if (!domainConfig) throw new Error('SiteContext is not configured with the site domains')
        return domainConfig
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
     * An href of a page on `site` as a link from outside the app, in emails and notifications: on the
     * site's main domain, or on WEBSITE_URL with the base path when the site has no domain.
     */
    static publicUrl(site: Site, href: string): string {
        const origin = SiteContext.config().mainOriginOfSite(site)
        return origin ? `${origin}${site.pathOn(href)}` : `${process.env.WEBSITE_URL}${href}`
    }

    toData(): SiteContextData {
        return { domain: this.domain, path: this.path }
    }

    /** The same visitor on another page of the app. */
    withPath(path: string): SiteContext {
        return new SiteContext(this.domain, path)
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
     * The href to render for an app path such as `/career/job-ads`, seen from here. On the page's own
     * site the path is site-relative. From an Omega domain another site sits under its base path. From
     * another site's domain the page is reached by its site's main domain, or by Omega's main domain
     * with the base path when its site has none. Anything but an app path is left as it is.
     */
    resolveHref(href: string, options: ResolveHrefOptions = {}): string {
        if (!isAppPath(href)) return href
        const config = SiteContext.config()
        const target = Site.ofPath(href)
        const onTarget = target.pathOn(href)
        const targetOrigin = config.mainOriginOfSite(target)
        if (options.viaDomain && targetOrigin) return `${targetOrigin}${onTarget}`
        if (target === this.hostSite()) return onTarget
        if (this.servesBasePaths()) return href
        if (targetOrigin) return `${targetOrigin}${onTarget}`
        const rootOrigin = config.mainOriginOfSite(Site.root)
        return rootOrigin ? `${rootOrigin}${href}` : href
    }
}
