import { DomainContext } from '@/lib/sites/context'

/** How long a client has to exchange an authorization code, which it does at once on the way back. */
export const OIDC_CODE_LIFETIME_MS = 2 * 60 * 1000

/** How long an ID token and an access token are good for, in seconds. */
export const OIDC_TOKEN_LIFETIME_S = 60 * 60

/**
 * The scope a token for the mail server carries, from the OAuth Profile for Open Public Clients
 * (draft-ietf-mailmaint-oauth-public), by which the mail server tells a token for the mailboxes from
 * any other, and the webmail asks for every scope of its kind the provider lists.
 */
export const OIDC_MAIL_SCOPE = 'urn:ietf:params:oauth:scope:mail'

/**
 * The scopes a client may ask for: `openid` for the ID token, the standard claims `profile` and
 * `email` name, and the mail scope, which the webmail alone is given.
 */
export const OIDC_SCOPES = ['openid', 'profile', 'email', OIDC_MAIL_SCOPE] as const
export type OidcScope = typeof OIDC_SCOPES[number]

/**
 * The claims the scopes give: the standard ones of OpenID Connect Core section 5.4, and `groups`
 * with the mail scope, the mailboxes the user may open, which the mail server reads as the groups
 * the user is a member of.
 */
export const OIDC_CLAIMS = ['sub', 'preferred_username', 'name', 'given_name', 'family_name', 'email', 'groups'] as const

/** The endpoints of the provider, served on the auth domain alone. */
export const oidcPaths = {
    discovery: '/.well-known/openid-configuration',
    authorize: '/api/oidc/authorize',
    token: '/api/oidc/token',
    userinfo: '/api/oidc/userinfo',
    jwks: '/api/oidc/jwks',
    endSession: '/api/oidc/end-session',
} as const

/** Where a site takes the code back, on its own domain. */
export const SSO_CALLBACK_PATH = '/api/sso/callback'

/** The issuer: the origin that signs users in, which every token names and every client checks. */
export const oidcIssuer = () => DomainContext.authOrigin()
