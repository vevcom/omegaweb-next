import type { PagesMount } from '@/lib/sites/defineLinks'

/**
 * How a site renders the mail server admin: a page per part of the mail server at
 * `${mountPath}/[part]`, each node of the mail flow at `${mountPath}/[type]/[id]`, and the mount
 * path itself forwarding to the mailing lists. Both sites administer the same mail server.
 */
export type MailServerPagesConfig = PagesMount
