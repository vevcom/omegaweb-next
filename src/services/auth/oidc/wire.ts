/**
 * The parameters of the protocol as they are spelled on the wire, by the fields the schemas name
 * them (schemas.ts). A route reads them off a query or a form with {@link fromWire}, and a client
 * of the provider writes them with {@link toWire}, so the spelling is here alone.
 */
export const oidcWireNames = {
    clientId: 'client_id',
    redirectUri: 'redirect_uri',
    responseType: 'response_type',
    scope: 'scope',
    state: 'state',
    nonce: 'nonce',
    codeChallenge: 'code_challenge',
    codeChallengeMethod: 'code_challenge_method',
    code: 'code',
    codeVerifier: 'code_verifier',
    grantType: 'grant_type',
    postLogoutRedirectUri: 'post_logout_redirect_uri',
} as const

export type OidcWireField = keyof typeof oidcWireNames

/** The fields named, read by their wire names: null for one that is not there, which the schemas refuse by name. */
export function fromWire<Field extends OidcWireField>(
    get: (wireName: string) => string | null,
    fields: readonly Field[],
): Record<Field, string | null> {
    return Object.fromEntries(fields.map(field => [field, get(oidcWireNames[field])])) as Record<Field, string | null>
}

/** The fields given, by their wire names, as a query string takes them. */
export function toWire(fields: Partial<Record<OidcWireField, string>>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(fields).map(([field, value]) => [oidcWireNames[field as OidcWireField], value]),
    )
}
