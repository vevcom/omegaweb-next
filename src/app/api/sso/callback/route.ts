import { domainContextOf } from '@/app/domainContextOfRequest'
import { startSession } from '@/auth/sso/session'
import { clearSsoStateCookie, readSsoStateCookie, ssoCookieOf } from '@/auth/sso/stateCookie'
import { sessionCookieOf } from '@/auth/nextAuth/sessionCookie'
import { oidcOperations } from '@/services/auth/oidc/operations'
import { SSO_CALLBACK_PATH } from '@/services/auth/oidc/constants'
import { Smorekopp } from '@/services/error'
import { DomainContext } from '@/lib/sites/context'
import { appHref } from '@/lib/sites/href'
import { Site } from '@/lib/sites/site'
import logger from '@/lib/logger'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Where the auth domain sends the browser back with a code, see the start route. The code is
 * exchanged in process, since the provider is this same app, and the session it names is started
 * on this domain. A sign in that went wrong lands the visitor on the site's frontpage, signed out,
 * since landing on the page they wanted would only send them round again.
 */
export async function GET(request: NextRequest) {
    const context = domainContextOf(request)
    const { secure } = sessionCookieOf(request.headers)
    const stored = readSsoStateCookie(request.cookies.get(ssoCookieOf(secure).name)?.value)
    const domain = DomainContext.domainOfHost(context.domain)
    if (!stored || !domain) {
        return new NextResponse('Innloggingen startet ikke her, eller for lenge siden. Prøv igjen.', {
            status: 400,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
    }
    const query = request.nextUrl.searchParams
    if (query.get('state') !== stored.state) {
        return new NextResponse('Innloggingen hører ikke til denne nettleseren.', {
            status: 400,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
    }

    const landOn = (href: typeof stored.callbackUrl) => {
        const response = NextResponse.redirect(new URL(context.resolveHref(href), request.nextUrl))
        clearSsoStateCookie(response, secure)
        return response
    }
    const frontpage = appHref(Site.ofPath(stored.callbackUrl).pagesPath('') || '/')

    const code = query.get('code')
    if (!code) {
        logger.warn('The auth domain refused a sign in', {
            error: query.get('error'),
            description: query.get('error_description'),
        })
        return landOn(frontpage)
    }
    try {
        const grant = await oidcOperations.exchangeCode({
            params: {
                clientId: domain.host,
                redirectUri: `${domain.origin}${SSO_CALLBACK_PATH}`,
                code,
                codeVerifier: stored.codeVerifier,
            },
        })
        if (grant.nonce !== stored.nonce) {
            logger.warn('A sign in came back with another nonce than it left with')
            return landOn(frontpage)
        }
        const response = landOn(stored.callbackUrl)
        await startSession(response, request, grant.userId, grant.provider)
        return response
    } catch (error) {
        if (!(error instanceof Smorekopp)) throw error
        logger.warn('A sign in could not be completed', { errorCode: error.errorCode, errors: error.errors })
        return landOn(frontpage)
    }
}
