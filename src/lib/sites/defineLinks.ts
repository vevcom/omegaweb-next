import { Site } from './site'
import type { SiteName } from './site'

/**
 * A set of pages served under one path of a site. A page kit's config extends this with what its
 * pages need, and each implementation of the kit declares its config next to its pages. The site
 * is carried by name, since a config is plain data that passes to client components.
 */
export type SitePages = {
    site: SiteName,
    /** Where on the site the pages live, relative to the site's root. */
    path: string,
}

/** The href of a page under the kit's path: a sub path, with a query string when given. */
export type Href = (subPath?: string, query?: string | null) => string

/**
 * Defines the links of a page kit as a function of a site's config for it. Pages and components
 * build every link into the kit through it, so none of them works out where it is rendered from
 * the url. A config is plain data and passes to client components, where functions cannot, so
 * components take the config and call the kit's links function themselves.
 */
export function defineLinks<Config extends SitePages, Links>(
    define: (href: Href, config: Config) => Links,
): (config: Config) => Links {
    return config => {
        const base = Site.of(config.site).pagesPath(config.path)
        // The root of the site at the root of the app is '', which is no href.
        return define((subPath = '', query) => `${`${base}${subPath}` || '/'}${query ? `?${query}` : ''}`, config)
    }
}
