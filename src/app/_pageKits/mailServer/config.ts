import type { PagesMount } from '@/lib/sites/defineLinks'
import type { SiteName } from '@/lib/sites/site'

/**
 * How a site renders the mail server admin: a page per part of the mail server at
 * `${mountPath}/[part]`, each node of the mail flow at `${mountPath}/[type]/[id]`, and the mount
 * path itself forwarding to the mailing lists. Every site administers the same mail server, and
 * every mail domain is offered everywhere; what differs is which one the alias form picks first.
 */
export type MailServerPagesConfig = PagesMount & {
    /** The site whose main domain the alias form has selected to begin with. */
    defaultDomainOfSite: SiteName,
}
