import '@pn-server-only'
import { userOperations } from '@/services/users/operations'
import { chatUserOperations } from '@/services/chat/users/operations'
import type { UserFiltered } from '@/services/users/types'
import type { Awaitable } from '@/lib/awaitable'

/**
 * The mail scope of the OAuth Profile for Open Public Clients (draft-ietf-mailmaint-oauth-public),
 * by which the mail server tells a token for the mailboxes from any other: it refuses one without
 * it. The webmail asks for it because the provider lists it.
 */
export const OIDC_MAIL_SCOPE = 'urn:ietf:params:oauth:scope:mail'

/** The scope the chat's sign in asks for, to be told who the user is on the chat. */
export const OIDC_CHAT_SCOPE = 'chat'

/** What a claim says: a string, or a list, as `groups` is. */
export type ClaimValue = string | string[]

/** How a claim is read for the user the token is about. */
type ClaimResolver = (user: UserFiltered) => Awaitable<ClaimValue>

/** The kinds of client the provider has, see clients.ts: the sites' domains, the webmail, and the chat's sign in. */
export type OidcClientKind = 'site' | 'webmail' | 'chat'

type OidcScopeDefinition = {
    /** The clients that may be given the scope. One asking for a scope it may not have is not given it. */
    clients: readonly OidcClientKind[],
    /** The claims the scope gives, and how each is read. */
    claims: Record<string, ClaimResolver>,
}

const EVERY_CLIENT = ['site', 'webmail', 'chat'] as const

/**
 * The scopes a client may ask for: who may have each, the claims it gives and how each is read.
 * This is the one place a scope or a claim is declared: the scopes and claims the discovery
 * document lists, what the schemas accept, what a client is given and what {@link userClaims}
 * resolves all follow from it. The claims go in the ID token, the access token and the userinfo
 * response alike.
 */
export const oidcScopes = {
    /** Who signed in, as `sub`, which every token carries and so no claim here repeats. */
    openid: { clients: EVERY_CLIENT, claims: {} },
    /** The standard claims of OpenID Connect Core section 5.4 that name the user. */
    profile: {
        clients: EVERY_CLIENT,
        claims: {
            preferred_username: user => user.username,
            name: user => `${user.firstname} ${user.lastname}`,
            given_name: user => user.firstname,
            family_name: user => user.lastname,
        },
    },
    email: {
        clients: EVERY_CLIENT,
        claims: { email: user => user.email },
    },
    /**
     * What makes a token one the mail server takes. It says nothing about the user: which mailboxes
     * they may open is not in the token, the mail server sync writes it to the server, see
     * src/lib/mailServerSync/memberships.ts.
     */
    [OIDC_MAIL_SCOPE]: { clients: ['webmail'], claims: {} },
    /**
     * Who the user is on the chat: the localpart of their Matrix id, which the chat's sign in makes
     * their account by. The application decides it, see src/services/chat/users, so the homeserver
     * never names a user itself. The user has it by the time a token is made, since the code the
     * token is traded for gave it to them, see clients.ts.
     */
    [OIDC_CHAT_SCOPE]: {
        clients: ['chat'],
        claims: {
            chat_localpart: async user =>
                (await chatUserOperations.read({ params: { userId: user.id }, bypassAuth: true })).localpart,
        },
    },
} as const satisfies Record<string, OidcScopeDefinition>

export type OidcScope = keyof typeof oidcScopes

export const OIDC_SCOPES = Object.keys(oidcScopes) as OidcScope[]

export const isOidcScope = (scope: string): scope is OidcScope => Object.hasOwn(oidcScopes, scope)

/** The scopes a kind of client may be given. */
export const scopesFor = (kind: OidcClientKind): OidcScope[] =>
    OIDC_SCOPES.filter(scope => (oidcScopes[scope].clients as readonly OidcClientKind[]).includes(kind))

/** Every claim a token may carry: the subject, and the claims of the scopes. */
export const OIDC_CLAIMS = ['sub', ...Object.values(oidcScopes).flatMap(scope => Object.keys(scope.claims))]

/** The claims of a user, by name. */
export type UserClaims = Record<string, ClaimValue>

/** What the scopes asked for say about a user: the claims of each, resolved for them. The subject is not among them. */
export async function userClaims(userId: number, scopes: readonly string[]): Promise<UserClaims> {
    const user = await userOperations.read({ params: { id: userId }, bypassAuth: true })
    const resolvers = scopes
        .filter(isOidcScope)
        .flatMap(scope => Object.entries(oidcScopes[scope].claims) as [string, ClaimResolver][])
    const claims = await Promise.all(resolvers.map(async ([claim, resolve]) => [claim, await resolve(user)] as const))
    return Object.fromEntries(claims)
}
