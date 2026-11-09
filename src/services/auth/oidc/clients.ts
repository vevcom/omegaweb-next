import { SSO_CALLBACK_PATH, oidcIssuer } from './constants'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'

export type OidcClient = {
    /** The client_id, which is the host of the domain. */
    id: string,
    /** Where the provider may send the code, and nowhere else, see RFC 6749 section 3.1.2. */
    redirectUris: string[],
    /** The site whose layout the sign in renders in, when the request names none. */
    site: Site,
    /** Whether the sign in may render in the layout of `site`: any site for a domain of Omega's, which serves them all. */
    rendersSite: (site: Site) => boolean,
}

/**
 * The clients of the provider: every domain of a site in sites.json, which signs its visitors in
 * through the provider and takes the code back at its SSO callback. They are public clients, since
 * the browser can see everything they do, so they prove themselves with PKCE rather than a secret.
 */
export function oidcClientOf(clientId: string): OidcClient | null {
    const domain = DomainContext.domainOfHost(clientId)
    if (!domain) return null
    const site = Site.of(domain.site)
    return {
        id: domain.host,
        redirectUris: [`${domain.origin}${SSO_CALLBACK_PATH}`],
        site,
        rendersSite: other => site.isRoot || other === site,
    }
}

/** Whether a logged out visitor may be sent to `uri`: a url of one of the clients, or of the provider itself. */
export function isPostLogoutRedirectUri(uri: string): boolean {
    const url = URL.parse(uri)
    if (!url) return false
    return url.origin === oidcIssuer() || DomainContext.domainOfHost(url.host)?.origin === url.origin
}
