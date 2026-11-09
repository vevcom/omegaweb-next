import { OIDC_MAIL_SCOPE, SSO_CALLBACK_PATH, oidcIssuer } from './constants'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import { mailServerWebmail } from '@/services/mail/server/constants'
import type { OidcScope } from './constants'

export type OidcClient = {
    /** The client_id: the host of a site's domain, or of the webmail. */
    id: string,
    /** Whether the provider may send a code to `uri`: only to one the client registered, see RFC 6749 section 3.1.2. */
    acceptsRedirectUri: (uri: string) => boolean,
    /** The scopes the client may be given. Others it asks for are left out of what it gets. */
    scopes: readonly OidcScope[],
    /** The site whose layout the sign in renders in, when the request names none. */
    site: Site,
    /** Whether the sign in may render in the layout of `site`: any site for a domain of Omega's, which serves them all. */
    rendersSite: (site: Site) => boolean,
}

const SITE_SCOPES: readonly OidcScope[] = ['openid', 'profile', 'email']

/**
 * Where the webmail takes the code back: its own origin, under the locale of the visitor, see
 * Bulwark's `/<locale>/auth/callback`. Any locale it may have, so the client is not registered anew
 * when it gains one.
 */
const WEBMAIL_CALLBACK_PATH = /^\/[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?\/auth\/callback$/

/**
 * The clients of the provider: every domain of a site in sites.json, which signs its visitors in
 * through the provider and takes the code back at its SSO callback, and the webmail, which does the
 * same at its callback and is the one client given the mail scope. They are public clients, since
 * the browser can see everything they do, so they prove themselves with PKCE rather than a secret.
 */
export function oidcClientOf(clientId: string): OidcClient | null {
    const webmail = webmailClient()
    if (webmail?.id === clientId) return webmail

    const domain = DomainContext.domainOfHost(clientId)
    if (!domain) return null
    const site = Site.of(domain.site)
    const redirectUri = `${domain.origin}${SSO_CALLBACK_PATH}`
    return {
        id: domain.host,
        acceptsRedirectUri: uri => uri === redirectUri,
        scopes: SITE_SCOPES,
        site,
        rendersSite: other => site.isRoot || other === site,
    }
}

/** The webmail as a client, named by its host, which is also the mailbox domain. Null without a webmail. */
function webmailClient(): OidcClient | null {
    if (!mailServerWebmail) return null
    const { origin, domain } = mailServerWebmail
    return {
        id: domain,
        acceptsRedirectUri: uri => {
            const url = URL.parse(uri)
            return url !== null
                && url.origin === origin
                && WEBMAIL_CALLBACK_PATH.test(url.pathname)
                && url.search === ''
                && url.hash === ''
        },
        scopes: [...SITE_SCOPES, OIDC_MAIL_SCOPE],
        site: Site.root,
        rendersSite: site => site.isRoot,
    }
}

/** Whether a logged out visitor may be sent to `uri`: a url of one of the clients, or of the provider itself. */
export function isPostLogoutRedirectUri(uri: string): boolean {
    const url = URL.parse(uri)
    if (!url) return false
    return url.origin === oidcIssuer()
        || url.origin === mailServerWebmail?.origin
        || DomainContext.domainOfHost(url.host)?.origin === url.origin
}
