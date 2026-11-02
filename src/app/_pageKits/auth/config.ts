import type { Site } from '@/lib/sites'

/** How a site renders the sign in and sign up flow. Its pages live under the site's base path. */
export type AuthPagesConfig = {
    site: Site,
    /** What the sign up welcomes the user to. */
    siteName: string,
    /** Where a login lands when there is no page to come back to. */
    afterLoginPath: string,
    afterLogoutPath: string,
    /** Explains during sign up where else the account is used. null on the account's own site. */
    accountNotice: string | null,
}
