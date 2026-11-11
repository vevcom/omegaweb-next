/**
 * How a site signs its visitors in: through the OpenID Connect provider on the auth domain, see
 * src/services/auth/oidc, as a client of it. The start route sends the browser there and the
 * callback takes the code back, see src/app/api/sso.
 */

/** Where a site sends a visitor to sign in, see ssoStartHref. */
export const SSO_START_PATH = '/api/sso/start'

/** How long the browser has to come back from the auth domain with a code, in seconds. */
export const SSO_STATE_MAX_AGE_S = 10 * 60

/** What a site asks the provider for: who signed in, and nothing it does not read from its own database. */
export const SSO_SCOPE = 'openid'
