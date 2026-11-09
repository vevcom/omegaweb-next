import { oidcIssuer, oidcPaths } from './constants'
import { OIDC_CLAIMS, OIDC_SCOPES } from './scopes'

/**
 * The document at `oidcPaths.discovery`, by which a client finds the endpoints and what they
 * support, see OpenID Connect Discovery section 3. Only the authorization code flow, with PKCE,
 * for public clients.
 */
export function discoveryDocument() {
    const issuer = oidcIssuer()
    return {
        issuer,
        authorization_endpoint: `${issuer}${oidcPaths.authorize}`,
        token_endpoint: `${issuer}${oidcPaths.token}`,
        userinfo_endpoint: `${issuer}${oidcPaths.userinfo}`,
        jwks_uri: `${issuer}${oidcPaths.jwks}`,
        end_session_endpoint: `${issuer}${oidcPaths.endSession}`,
        response_types_supported: ['code'],
        response_modes_supported: ['query'],
        grant_types_supported: ['authorization_code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['ES256'],
        scopes_supported: [...OIDC_SCOPES],
        claims_supported: [...OIDC_CLAIMS],
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256'],
    }
}
