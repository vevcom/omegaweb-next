import { z } from 'zod'

export const siteNameSchema = z.enum(['OMEGAWEB', 'CAREERS', 'REVUE'])
export type SiteName = z.infer<typeof siteNameSchema>

/**
 * One of the sites this app serves: Omega's own at the root, and the career and revue sites under
 * their base paths. Always one of the instances below, picked by name or from a path, so two
 * references to a site can be compared with `===`. Data such as page configs and the domain config
 * carries the site by its name, since it crosses to the browser as plain json.
 */
export class Site {
    private constructor(
        readonly name: SiteName,
        /** Where the site's pages live under the root site's domains. '' for the root site itself. */
        readonly basePath: string,
    ) {}

    static readonly OMEGAWEB = new Site('OMEGAWEB', '')
    static readonly CAREERS = new Site('CAREERS', '/career')
    static readonly REVUE = new Site('REVUE', '/revue')
    static readonly all: readonly Site[] = [Site.OMEGAWEB, Site.CAREERS, Site.REVUE]
    /** The site at the root of the app. Its domains also serve the other sites, under their base paths. */
    static readonly root: Site = Site.OMEGAWEB

    private static readonly byName: Record<SiteName, Site> = {
        OMEGAWEB: Site.OMEGAWEB,
        CAREERS: Site.CAREERS,
        REVUE: Site.REVUE,
    }

    static of(name: SiteName): Site {
        return Site.byName[name]
    }

    /** The site an app path belongs to: the one whose base path starts it, or the root site, which serves the rest. */
    static ofPath(path: string): Site {
        const site = Site.all.find(candidate => !candidate.isRoot && (
            path === candidate.basePath
            || path.startsWith(`${candidate.basePath}/`)
            || path.startsWith(`${candidate.basePath}?`)
        ))
        return site ?? Site.root
    }

    get isRoot(): boolean {
        return this === Site.root
    }

    /** The absolute app path of the pages at `path`, relative to this site's root. '' is the site's frontpage. */
    pagesPath(path: string): string {
        return `${this.basePath}${path}`
    }

    /** An app path of a page on this site as the site's own domain serves it: without the base path. */
    pathOn(href: string): string {
        const rest = href.slice(this.basePath.length)
        if (rest === '' || rest.startsWith('?') || rest.startsWith('#')) return `/${rest}`
        // What is left starts with one slash: a browser reads `//`, `/\` and `/<tab>/` there as
        // another host, so `/career//evil.example` must not become a link out of the site.
        return rest.replace(/^[/\\\s]+/, '/')
    }
}
