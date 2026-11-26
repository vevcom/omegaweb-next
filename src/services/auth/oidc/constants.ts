import { DomainContext } from '@/lib/sites/context'

/** How long a client has to exchange an authorization code, which it does at once on the way back. */
export const OIDC_CODE_LIFETIME_MS = 2 * 60 * 1000

/** How long an ID token and an access token are good for, in seconds. */
export const OIDC_TOKEN_LIFETIME_S = 60 * 60

/** How long a logout token is good for, in seconds. A client is handed it once, as it is signed. */
export const OIDC_LOGOUT_TOKEN_LIFETIME_S = 2 * 60

/** How long a client may take to answer when it is told of a sign out, before the logout goes on without it. */
export const OIDC_BACKCHANNEL_LOGOUT_TIMEOUT_MS = 3 * 1000

/**
 * The one shape of the protocol the provider speaks: the schemas refuse anything else, the discovery
 * document publishes it, the tokens are signed by it, and the sites ask for it.
 */
export const oidcProtocol = {
    /** The authorization code flow, RFC 6749 section 4.1, and nothing else. */
    responseType: 'code',
    responseMode: 'query',
    grantType: 'authorization_code',
    /** PKCE with a hashed verifier, RFC 7636 section 4.2. */
    codeChallengeMethod: 'S256',
    tokenSigningAlgorithm: 'ES256',
    /** Public clients, which prove themselves with PKCE and no secret. */
    tokenEndpointAuthMethod: 'none',
    subjectType: 'public',
    /** What a logout token says of itself and of what happened, OpenID Connect Back-Channel Logout 1.0 section 2.4. */
    logoutTokenType: 'logout+jwt',
    logoutEvent: 'http://schemas.openid.net/event/backchannel-logout',
} as const

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
