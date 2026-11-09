import { noSession, providerRoute } from '@/app/api/oidc/provider'
import { apiHandler } from '@/api/apiHandler'
import { oidcOperations } from '@/services/auth/oidc/operations'
import { sessionCookieOf } from '@/auth/nextAuth/sessionCookie'
import { NextResponse } from 'next/server'

/**
 * The end session endpoint of OpenID Connect RP-Initiated Logout: a site that has logged its visitor
 * out sends the browser here to end the session on the auth domain too, so the next sign in asks
 * for credentials again. The visitor is sent on to the uri the site gave, when it is one of ours.
 */
export const GET = providerRoute(apiHandler({
    serviceOperation: oidcOperations.endSession,
    session: noSession,
    query: query => ({ postLogoutRedirectUri: query.get('post_logout_redirect_uri') }),
    respond: ({ redirectTo }, request) => {
        const cookie = sessionCookieOf(request.headers)
        const response = NextResponse.redirect(redirectTo)
        response.cookies.set(cookie.name, '', {
            maxAge: 0, path: '/', httpOnly: true, secure: cookie.secure, sameSite: 'lax',
        })
        return response
    },
}))
