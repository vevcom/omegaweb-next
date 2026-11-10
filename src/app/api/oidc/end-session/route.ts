import { noSession, providerRoute } from '@/app/api/oidc/provider'
import { apiHandler } from '@/api/apiHandler'
import { oidcOperations } from '@/services/auth/oidc/operations'
import { fromWire } from '@/services/auth/oidc/wire'
import { endSession } from '@/auth/sso/session'
import { NextResponse } from 'next/server'

/**
 * The end session endpoint of OpenID Connect RP-Initiated Logout: a site that has logged its visitor
 * out sends the browser here to end the session on the auth domain too, so the next sign in asks
 * for credentials again. The visitor is sent on to the uri the site gave, when it is one of ours.
 */
export const GET = providerRoute(apiHandler({
    serviceOperation: oidcOperations.endSession,
    session: noSession,
    query: query => fromWire(name => query.get(name), ['postLogoutRedirectUri']),
    respond: ({ redirectTo }, request) => {
        const response = NextResponse.redirect(redirectTo)
        endSession(response, request)
        return response
    },
}))
