import '@pn-server-only'
import { userOperations } from '@/services/users/operations'
import { mailboxesReceivedBy } from '@/services/mail/received'
import type { UserFiltered } from '@/services/users/types'
import type { Awaitable } from '@/lib/awaitable'

/**
 * The mail scope of the OAuth Profile for Open Public Clients (draft-ietf-mailmaint-oauth-public),
 * by which the mail server tells a token for the mailboxes from any other, and which the webmail
 * asks for because the provider lists it.
 */
export const OIDC_MAIL_SCOPE = 'urn:ietf:params:oauth:scope:mail'

/** What a claim says: a string, or a list, as `groups` is. */
export type ClaimValue = string | string[]

/** How a claim is read for the user the token is about. */
type ClaimResolver = (user: UserFiltered) => Awaitable<ClaimValue>

/**
 * The scopes a client may ask for, each with the claims it gives and how each is read. This is the
 * one place a scope or a claim is declared: the scopes and claims the discovery document lists,
 * what the schemas accept and what {@link userClaims} resolves all follow from it. The claims go
 * in the ID token, the access token and the userinfo response alike.
 */
export const oidcScopes = {
    /** Who signed in, as `sub`, which every token carries and so no claim here repeats. */
    openid: {},
    /** The standard claims of OpenID Connect Core section 5.4 that name the user. */
    profile: {
        preferred_username: user => user.username,
        name: user => `${user.firstname} ${user.lastname}`,
        given_name: user => user.firstname,
        family_name: user => user.lastname,
    },
    email: {
        email: user => user.email,
    },
    /**
     * The mailboxes the user may open, which the mail server reads as the groups the user is a
     * member of. Given to the webmail alone, see clients.ts.
     */
    [OIDC_MAIL_SCOPE]: {
        groups: user => mailboxesReceivedBy(user.id),
    },
} as const satisfies Record<string, Record<string, ClaimResolver>>

export type OidcScope = keyof typeof oidcScopes

export const OIDC_SCOPES = Object.keys(oidcScopes) as OidcScope[]

export const isOidcScope = (scope: string): scope is OidcScope => Object.hasOwn(oidcScopes, scope)

/** Every claim a token may carry: the subject, and the claims of the scopes. */
export const OIDC_CLAIMS = ['sub', ...Object.values(oidcScopes).flatMap(claims => Object.keys(claims))]

/** The claims of a user, by name. */
export type UserClaims = Record<string, ClaimValue>

/** What the scopes asked for say about a user: the claims of each, resolved for them. The subject is not among them. */
export async function userClaims(userId: number, scopes: readonly string[]): Promise<UserClaims> {
    const user = await userOperations.read({ params: { id: userId }, bypassAuth: true })
    const resolvers = scopes
        .filter(isOidcScope)
        .flatMap(scope => Object.entries(oidcScopes[scope]) as [string, ClaimResolver][])
    const claims = await Promise.all(resolvers.map(async ([claim, resolve]) => [claim, await resolve(user)] as const))
    return Object.fromEntries(claims)
}
