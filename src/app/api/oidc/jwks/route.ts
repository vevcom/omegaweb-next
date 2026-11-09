import { CACHED_FOR_AN_HOUR, jsonWith, noSession, providerRoute } from '@/app/api/oidc/provider'
import { apiHandler } from '@/api/apiHandler'
import { oidcOperations } from '@/services/auth/oidc/operations'

/** The key set, RFC 7517, that the provider's tokens are verified with. */
export const GET = providerRoute(apiHandler({
    serviceOperation: oidcOperations.jwks,
    session: noSession,
    respond: jsonWith(CACHED_FOR_AN_HOUR),
}))
