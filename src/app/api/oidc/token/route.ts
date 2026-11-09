import { NO_STORE, jsonWith, noSession, oauthErrorResponse, providerRoute } from '@/app/api/oidc/provider'
import { apiHandler } from '@/api/apiHandler'
import { oidcOperations } from '@/services/auth/oidc/operations'

/** The token endpoint, RFC 6749 section 4.1.3: the form of section 4.1.3 in, the token response of section 5.1 out. */
export const POST = providerRoute(apiHandler({
    serviceOperation: oidcOperations.token,
    session: noSession,
    body: 'form',
    data: form => ({
        grantType: field(form, 'grant_type'),
        clientId: field(form, 'client_id'),
        redirectUri: field(form, 'redirect_uri'),
        code: field(form, 'code'),
        codeVerifier: field(form, 'code_verifier'),
    }),
    respond: jsonWith(NO_STORE),
    respondError: oauthErrorResponse,
}))

/** A field of the form, as a string: absent is empty, which the schema refuses. */
function field(form: unknown, name: string): string {
    const value = (form as FormData).get(name)
    return typeof value === 'string' ? value : ''
}
