import { domainContextOf } from '@/app/domainContextOfRequest'
import { SSO_SCOPE } from '@/auth/sso/constants'
import { ssoStartHref } from '@/auth/sso/links'
import { readSessionToken } from '@/auth/sso/session'
import { codeChallengeOf, newSsoState, setSsoStateCookie } from '@/auth/sso/stateCookie'
import { sessionCookieOf } from '@/auth/nextAuth/sessionCookie'
import { SSO_CALLBACK_PATH, oidcPaths } from '@/services/auth/oidc/constants'
import { authLinks } from '@/pageKits/auth/links'
import { authPagesOf } from '@/pageKits/auth/authPagesOf'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { DomainContext, isAppWidePath } from '@/lib/sites/context'
import { appHref } from '@/lib/sites/href'
import { Site } from '@/lib/sites/site'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Where a site sends a visitor to sign in, see ssoStartHref. On a site's domain it remembers where
 * the visitor was going, in a cookie, and sends the browser to the authorize endpoint on the auth
 * domain, which sends it back to the callback with a code. On the auth domain itself there is no
 * code to fetch: a visitor with a session goes on, one without goes to the login form. A domain set
 * apart for signing in serves no page, so from there the visitor is sent to the start route of the
 * domain their page is on, whose session is the one that matters.
 */
export async function GET(request: NextRequest) {
    const context = domainContextOf(request)
    const callbackUrl = QueryParams.callbackUrl.decode(Object.fromEntries(request.nextUrl.searchParams)) ?? appHref('/')
    const site = Site.ofPath(callbackUrl)
    const onward = () => NextResponse.redirect(new URL(context.resolveHref(callbackUrl), request.nextUrl))

    if (context.isDedicatedAuthDomain() && !isAppWidePath(callbackUrl)) {
        return NextResponse.redirect(`${DomainContext.originOfSite(site)}${ssoStartHref(callbackUrl)}`)
    }
    if (await readSessionToken(request)) return onward()
    if (context.isAuthDomain()) {
        return NextResponse.redirect(DomainContext.authDomainUrl(authLinks(authPagesOf(site)).loginForm({ callbackUrl })))
    }

    const domain = DomainContext.domainOfHost(context.domain)
    if (!domain) return new NextResponse('Not found', { status: 404, headers: { 'content-type': 'text/plain' } })
    const state = newSsoState(callbackUrl)
    const authorize = new URL(oidcPaths.authorize, DomainContext.authOrigin())
    authorize.search = new URLSearchParams({
        response_type: 'code',
        client_id: domain.host,
        redirect_uri: `${domain.origin}${SSO_CALLBACK_PATH}`,
        scope: SSO_SCOPE,
        state: state.state,
        nonce: state.nonce,
        code_challenge: codeChallengeOf(state.codeVerifier),
        code_challenge_method: 'S256',
        // Our own parameter: the login renders in the layout of the site the visitor was on.
        site: site.name,
    }).toString()
    const response = NextResponse.redirect(authorize)
    setSsoStateCookie(response, sessionCookieOf(request.headers).secure, state)
    return response
}
