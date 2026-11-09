import { oidcIssuer, oidcPaths, oidcProtocol } from './constants'
import { OIDC_CLAIMS, OIDC_SCOPES } from './scopes'

/**
 * The document at `oidcPaths.discovery`, by which a client finds the endpoints and what they
 * support, see OpenID Connect Discovery section 3: the one protocol of oidcProtocol, and the
 * scopes and claims of oidcScopes.
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
        response_types_supported: [oidcProtocol.responseType],
        response_modes_supported: [oidcProtocol.responseMode],
        grant_types_supported: [oidcProtocol.grantType],
        subject_types_supported: [oidcProtocol.subjectType],
        id_token_signing_alg_values_supported: [oidcProtocol.tokenSigningAlgorithm],
        scopes_supported: [...OIDC_SCOPES],
        claims_supported: [...OIDC_CLAIMS],
        token_endpoint_auth_methods_supported: [oidcProtocol.tokenEndpointAuthMethod],
        code_challenge_methods_supported: [oidcProtocol.codeChallengeMethod],
    }
}
