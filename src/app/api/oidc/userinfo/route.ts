import { NO_STORE, jsonWith, noSession, oauthErrorOf, providerRoute } from '@/app/api/oidc/provider'
import { apiHandler } from '@/api/apiHandler'
import { oidcOperations } from '@/services/auth/oidc/operations'
import { NextResponse } from 'next/server'
import type { ApiError } from '@/api/apiHandler'

/** The userinfo endpoint, OpenID Connect Core section 5.3: the claims of the user the bearer token is for. */
const handler = providerRoute(apiHandler({
    serviceOperation: oidcOperations.userinfo,
    session: noSession,
    query: (_, request) => ({ accessToken: /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? '' }),
    respond: jsonWith(NO_STORE),
    respondError: respondUserinfoError,
}))

/** A refusal as RFC 6750 section 3 has it: 401, with the error in the challenge. */
function respondUserinfoError(error: ApiError): Response {
    const { error: code, description } = oauthErrorOf(error)
    const challenge = code === 'invalid_request' ? 'Bearer' : `Bearer error="${code}", error_description="${description}"`
    return new NextResponse(null, { status: 401, headers: { 'WWW-Authenticate': challenge } })
}

export { handler as GET, handler as POST }
