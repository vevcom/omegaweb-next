import { providerRoute } from '@/app/api/oidc/provider'
import { isPostLogoutRedirectUri } from '@/services/auth/oidc/clients'
import { oidcIssuer } from '@/services/auth/oidc/constants'
import { sessionCookieOf } from '@/auth/nextAuth/sessionCookie'
import { NextResponse } from 'next/server'

/**
 * The end session endpoint of OpenID Connect RP-Initiated Logout: a site that has logged its visitor
 * out sends the browser here to end the session on the auth domain too, so the next sign in asks
 * for credentials again. The visitor is sent on to the uri the site gave, when it is one of ours.
 */
export const GET = providerRoute(request => {
    const requested = request.nextUrl.searchParams.get('post_logout_redirect_uri')
    const back = requested && isPostLogoutRedirectUri(requested) ? requested : `${oidcIssuer()}/`
    const cookie = sessionCookieOf(request.headers)
    const response = NextResponse.redirect(back)
    response.cookies.set(cookie.name, '', { maxAge: 0, path: '/', httpOnly: true, secure: cookie.secure, sameSite: 'lax' })
    return response
})
