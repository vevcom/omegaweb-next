import LogOut from '@/pageKits/auth/components/LogOut'
import { authLinks } from '@/pageKits/auth/links'
import { redirectToServingDomain } from '@/app/domainContextOfRequest'
import type { AuthPagesConfig } from '@/pageKits/auth/config'

/**
 * Served on the site, since logging out clears the cookie of the domain the visitor is on. It is
 * not built with serverPage, so it sends a request that reached the wrong domain on itself.
 */
export function logoutPage(config: AuthPagesConfig) {
    return async function LogoutPage() {
        await redirectToServingDomain()
        return <LogOut callbackUrl={authLinks(config).afterLogout()} />
    }
}
