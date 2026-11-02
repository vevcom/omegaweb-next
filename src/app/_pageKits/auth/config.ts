import type { SitePages } from '@/lib/sites'

/** How a site renders the sign in and sign up flow. Its pages sit at the site's root, so `path` is ''. */
export type AuthPagesConfig = SitePages & {
    /** What the sign up welcomes the user to. */
    siteName: string,
    /** Where a login lands when there is no page to come back to, relative to the site's root. '' is the frontpage. */
    afterLoginPath: string,
    afterLogoutPath: string,
    /** Explains during sign up where else the account is used. null on the account's own site. */
    accountNotice: string | null,
}
