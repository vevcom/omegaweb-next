import { DomainContext } from '@/lib/sites/context'

/** How long a client has to exchange an authorization code, which it does at once on the way back. */
export const OIDC_CODE_LIFETIME_MS = 2 * 60 * 1000

/** How long an ID token and an access token are good for, in seconds. */
export const OIDC_TOKEN_LIFETIME_S = 60 * 60

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
