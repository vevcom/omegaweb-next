import { SSO_CALLBACK_PATH, oidcIssuer } from './constants'
import { scopesFor } from './scopes'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import { mailServerWebmail } from '@/lib/mailServerSync/constants'
import { chatAuth } from '@/services/chat/constants'
import { chatUserOperations } from '@/services/chat/users/operations'
import type { OidcClientKind, OidcScope } from './scopes'

export type OidcClient = {
    /** The client_id: the host of a site's domain, of the webmail, or of the chat's sign in. */
    id: string,
    kind: OidcClientKind,
    /** Whether the provider may send a code to `uri`: only to one the client registered, see RFC 6749 section 3.1.2. */
    acceptsRedirectUri: (uri: string) => boolean,
    /** The scopes the client may be given, which the scopes say (scopes.ts). Others it asks for are left out. */
    scopes: readonly OidcScope[],
    /** The site whose layout the sign in renders in, when the request names none. */
    site: Site,
    /** Whether the sign in may render in the layout of `site`: any site for a domain of Omega's, which serves them all. */
    rendersSite: (site: Site) => boolean,
    /**
     * What signing in to the client sets up for the user, before they are given a code. It runs at
     * every sign in, as the user, so it does nothing the second time.
     */
    beforeCode?: (userId: number) => Promise<unknown>,
}

/**
 * Where the webmail takes the code back: its own origin, under the locale of the visitor, see
 * Bulwark's `/<locale>/auth/callback`. Any locale it may have, so the client is not registered anew
 * when it gains one.
 */
const WEBMAIL_CALLBACK_PATH = /^\/[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?\/auth\/callback$/

/**
 * Where the chat's sign in, MAS, takes the code back: its callback for the provider it knows the
 * application as, which its config names by a ULID.
 */
const CHAT_CALLBACK_PATH = /^\/upstream\/callback\/[0-9A-HJKMNP-TV-Z]{26}$/

/** Whether `uri` is a path of `origin` that `path` takes, with nothing after it. */
const isCallbackOf = (origin: string, path: RegExp) => (uri: string) => {
    const url = URL.parse(uri)
    return url !== null
        && url.origin === origin
        && path.test(url.pathname)
        && url.search === ''
        && url.hash === ''
}

/**
 * The clients of the provider: every domain of a site in sites.json, which signs its visitors in
 * through the provider and takes the code back at its SSO callback, and the webmail and the chat's
 * sign in, which do the same at their callbacks. They are public clients, which prove themselves
 * with PKCE rather than a secret.
 */
export function oidcClientOf(clientId: string): OidcClient | null {
    const webmail = webmailClient()
    if (webmail?.id === clientId) return webmail
    const chat = chatClient()
    if (chat?.id === clientId) return chat

    const domain = DomainContext.domainOfHost(clientId)
    if (!domain) return null
    const site = Site.of(domain.site)
    const redirectUri = `${domain.origin}${SSO_CALLBACK_PATH}`
    return {
        id: domain.host,
        kind: 'site',
        acceptsRedirectUri: uri => uri === redirectUri,
        scopes: scopesFor('site'),
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
        kind: 'webmail',
        acceptsRedirectUri: isCallbackOf(origin, WEBMAIL_CALLBACK_PATH),
        scopes: scopesFor('webmail'),
        site: Site.root,
        rendersSite: site => site.isRoot,
    }
}

/**
 * The chat's sign in as a client, named by its host. Null without a chat. Signing in to it is how a
 * user opts in to the chat: they are given their account there before the code, so the token says
 * who they are on the chat. Like the webmail it has no site of its own.
 */
function chatClient(): OidcClient | null {
    if (!chatAuth) return null
    return {
        id: chatAuth.host,
        kind: 'chat',
        acceptsRedirectUri: isCallbackOf(chatAuth.origin, CHAT_CALLBACK_PATH),
        scopes: scopesFor('chat'),
        site: Site.root,
        rendersSite: site => site.isRoot,
        beforeCode: userId => chatUserOperations.optIn({ params: { userId } }),
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
