/**
 * How a site signs its visitors in: through the OpenID Connect provider on the auth domain, see
 * src/services/auth/oidc, as a client of it. The start route sends the browser there and the
 * callback takes the code back, see src/app/api/sso.
 */

/** Where a site sends a visitor to sign in, see ssoStartHref. */
export const SSO_START_PATH = '/api/sso/start'

/**
 * The longest page, url-encoded, the start route hands the login form as `destination`. The form's
 * url holds it once and again inside its callbackUrl, where each `%XX` grows to `%25XX`, so at most
 * 8/3 of this, 4 KB, which leaves half of the 8 KB a proxy commonly allows a request line.
 */
export const SSO_DESTINATION_MAX_ENCODED_LENGTH = 1536

/** How long the browser has to come back from the auth domain with a code, in seconds. */
export const SSO_STATE_MAX_AGE_S = 10 * 60

/** What a site asks the provider for: who signed in, and nothing it does not read from its own database. */
export const SSO_SCOPE = 'openid'
