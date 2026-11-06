import { appHref } from './href'
import { Site } from './site'
import type { AppHref } from './href'
import type { SiteName } from './site'

/**
 * Where a set of pages is mounted in the router: on which site, and at which path under that site's
 * root. A page kit's config extends this with what its pages need, and each implementation of the
 * kit declares its config next to its pages; a site's own pages are mounted at its root. The site
 * is carried by name, since a config is plain data that passes to client components.
 */
export type PagesMount = {
    site: SiteName,
    /** Where under the site's root the pages are mounted. '' for the root itself. */
    mountPath: string,
}

/** The href of a page under the mount: a sub path, with a query string when given. */
export type Href = (subPath?: string, query?: string | null) => AppHref

/**
 * Defines the links of a page kit as a function of a site's config for it. Pages and components
 * build every link into the kit through it, so none of them works out where it is rendered from
 * the url. A config is plain data and passes to client components, where functions cannot, so
 * components take the config and call the kit's links function themselves.
 */
export function defineLinks<Config extends PagesMount, Links>(
    define: (href: Href, config: Config) => Links,
): (config: Config) => Links {
    return config => {
        const base = Site.of(config.site).pagesPath(config.mountPath)
        // The root of the site at the root of the app is '', which is no href.
        const href: Href = (subPath = '', query) => {
            const path = `${base}${subPath}` || '/'
            return appHref(`${path}${query ? `?${query}` : ''}`)
        }
        return define(href, config)
    }
}
