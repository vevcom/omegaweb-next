import { DomainContext } from '@/lib/sites/context'

/** How long a client has to exchange an authorization code, which it does at once on the way back. */
export const OIDC_CODE_LIFETIME_MS = 2 * 60 * 1000

/** How long an ID token and an access token are good for, in seconds. */
export const OIDC_TOKEN_LIFETIME_S = 60 * 60

/** The scopes a client may ask for: `openid` for the ID token, and the standard claims the other two name. */
export const OIDC_SCOPES = ['openid', 'profile', 'email'] as const
export type OidcScope = typeof OIDC_SCOPES[number]

/** The claims the scopes give, see OpenID Connect Core section 5.4. */
export const OIDC_CLAIMS = ['sub', 'preferred_username', 'name', 'given_name', 'family_name', 'email'] as const

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
