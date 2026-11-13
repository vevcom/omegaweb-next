import { oauthErrorResponse, oauthErrorOf, providerRoute } from '@/app/api/oidc/provider'
import { apiHandler } from '@/api/apiHandler'
import { oidcOperations } from '@/services/auth/oidc/operations'
import { oidcClientOf } from '@/services/auth/oidc/clients'
import { fromWire } from '@/services/auth/oidc/wire'
import { readSessionToken, sessionFromCookie } from '@/auth/sso/session'
import { authLinks } from '@/pageKits/auth/links'
import { authPagesOf } from '@/pageKits/auth/authPagesOf'
import { DomainContext } from '@/lib/sites/context'
import { appHref } from '@/lib/sites/href'
import { Site, siteNameSchema } from '@/lib/sites/site'
import { Smorekopp } from '@/services/error'
import { NextResponse } from 'next/server'
import type { ApiError } from '@/api/apiHandler'
import type { NextRequest } from 'next/server'

/** The handler gets a Request by type and a NextRequest in fact, as every route does. */
const asNextRequest = (request: Request) => request as NextRequest

/**
 * The authorization endpoint, RFC 6749 section 4.1.1 with the PKCE of RFC 7636: a client sends the
 * browser here to have its visitor signed in. A visitor with a session on this domain is sent back
 * to the client with a code for them. One without is sent to the login page, in the layout of the
 * site they came from, and comes back here once through it.
 */
export const GET = providerRoute(apiHandler({
    serviceOperation: oidcOperations.issueCode,
    session: request => sessionFromCookie(asNextRequest(request)),
    query: async (query, request) => {
        const token = await readSessionToken(asNextRequest(request))
        // A company user's session is for the career site alone and is never handed on to a client,
        // so to this endpoint a company user is not signed in.
        if (!token?.user || token.provider === 'company-credentials') {
            throw new Smorekopp('UNAUTHENTICATED', 'Logg inn for å fortsette')
        }
        return {
            userId: token.user.id,
            provider: token.provider,
            ...fromWire(name => query.get(name), [
                'clientId', 'redirectUri', 'responseType', 'scope', 'state', 'nonce', 'codeChallenge', 'codeChallengeMethod',
            ]),
        }
    },
    respond: ({ redirectUri, code, state }) => NextResponse.redirect(withParams(redirectUri, { code, state })),
    respondError: (error, request) => respondAuthorizeError(error, asNextRequest(request)),
}))

function withParams(uri: string, params: Record<string, string | null>): URL {
    const url = new URL(uri)
    for (const [name, value] of Object.entries(params)) {
        if (value !== null) url.searchParams.set(name, value)
    }
    return url
}

/**
 * A failure goes back to the client with the code of section 4.1.2.1, as long as the client and
 * its redirect uri are known: nothing is sent to a uri the client has not registered, so those two
 * mistakes are answered here. No session is no failure of the client's: the visitor goes to the
 * login page, in the layout of the site the client named among those it serves, and comes back.
 */
function respondAuthorizeError(error: ApiError, request: NextRequest): Response {
    const query = request.nextUrl.searchParams
    const { clientId, redirectUri, state } = fromWire(name => query.get(name), ['clientId', 'redirectUri', 'state'])
    const client = oidcClientOf(clientId ?? '')
    if (!redirectUri || !client?.acceptsRedirectUri(redirectUri)) {
        return oauthErrorResponse({
            errorCode: 'BAD PARAMETERS',
            errors: [{ message: 'Unknown client_id, or a redirect_uri it has not registered' }],
        })
    }
    if (error.errorCode === 'UNAUTHENTICATED') {
        const requestedSite = siteNameSchema.safeParse(query.get('site'))
        const site = requestedSite.success && client.rendersSite(Site.of(requestedSite.data))
            ? Site.of(requestedSite.data)
            : client.site
        const here = appHref(`${request.nextUrl.pathname}${request.nextUrl.search}`)
        const form = authLinks(authPagesOf(site)).loginForm({ callbackUrl: here })
        return NextResponse.redirect(DomainContext.authDomainUrl(form))
    }
    const { error: code, description } = oauthErrorOf(error)
    return NextResponse.redirect(withParams(redirectUri, { error: code, error_description: description, state }))
}
