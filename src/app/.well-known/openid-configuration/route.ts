import { CACHED_FOR_AN_HOUR, jsonWith, noSession, providerRoute } from '@/app/api/oidc/provider'
import { apiHandler } from '@/api/apiHandler'
import { oidcOperations } from '@/services/auth/oidc/operations'

/** The discovery document, OpenID Connect Discovery section 4. */
export const GET = providerRoute(apiHandler({
    serviceOperation: oidcOperations.discovery,
    session: noSession,
    respond: jsonWith(CACHED_FOR_AN_HOUR),
}))
