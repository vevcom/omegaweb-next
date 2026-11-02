import { sitePagesPath } from '@/lib/sites'
import type { SitePages } from '@/lib/sites'

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
        const base = sitePagesPath(config)
        return define((subPath = '', query) => `${base}${subPath}${query ? `?${query}` : ''}`, config)
    }
}
