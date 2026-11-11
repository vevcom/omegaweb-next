import { NO_STORE, jsonWith, noSession, oauthErrorResponse, providerRoute } from '@/app/api/oidc/provider'
import { apiHandler } from '@/api/apiHandler'
import { oidcOperations } from '@/services/auth/oidc/operations'
import { fromWire } from '@/services/auth/oidc/wire'

/** The token endpoint, RFC 6749 section 4.1.3: the form of section 4.1.3 in, the token response of section 5.1 out. */
export const POST = providerRoute(apiHandler({
    serviceOperation: oidcOperations.token,
    session: noSession,
    body: 'form',
    data: form => fromWire(
        name => field(form, name),
        ['grantType', 'clientId', 'redirectUri', 'code', 'codeVerifier'],
    ),
    respond: jsonWith(NO_STORE),
    respondError: oauthErrorResponse,
}))

/** A field of the form as a string, null when absent or a file. */
function field(form: unknown, name: string): string | null {
    const value = (form as FormData).get(name)
    return typeof value === 'string' ? value : null
}
