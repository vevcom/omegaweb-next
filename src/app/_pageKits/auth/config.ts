import type { PagesMount } from '@/lib/sites/defineLinks'

/**
 * How a site renders the sign in and sign up flow. Its pages sit at the site's root, at the sub
 * paths authPagePaths names, which is what lets DomainContext tell an auth page from its path alone.
 */
export type AuthPagesConfig = PagesMount<''> & {
    /** What the sign up welcomes the user to. */
    siteName: string,
    /** Where a login lands when there is no page to come back to, relative to the site's root. '' is the frontpage. */
    afterLoginPath: string,
    afterLogoutPath: string,
    /** Explains during sign up where else the account is used. null on the account's own site. */
    accountNotice: string | null,
    /** Whether sign up asks the user's sex, which Omega's own site does and a site for companies has no use for. */
    asksSex: boolean,
}
