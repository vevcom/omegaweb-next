import { describeError, oauthError, providerRoute } from '@/app/api/oidc/provider'
import { oidcOperations } from '@/services/auth/oidc/operations'
import { oidcClientOf } from '@/services/auth/oidc/clients'
import { readSessionToken } from '@/auth/sso/session'
import { Session } from '@/auth/session/Session'
import { authLinks } from '@/pageKits/auth/links'
import { authPagesOf } from '@/pageKits/auth/authPagesOf'
import { DomainContext } from '@/lib/sites/context'
import { appHref } from '@/lib/sites/href'
import { Site, siteNameSchema } from '@/lib/sites/site'
import { Smorekopp } from '@/services/error'
import { NextResponse } from 'next/server'

/**
 * The authorization endpoint, RFC 6749 section 4.1.1 with the PKCE of RFC 7636: a client sends the
 * browser here to have its visitor signed in. A visitor with no session on this domain is sent to
 * the login page, in the layout of the site they came from, and comes back here once through it.
 * One with a session is sent back to the client with a code for them.
 */
export const GET = providerRoute(async request => {
    const query = request.nextUrl.searchParams
    const clientId = query.get('client_id') ?? ''
    const redirectUri = query.get('redirect_uri') ?? ''
    const client = oidcClientOf(clientId)
    // Nothing is sent to a uri the client has not registered, section 4.1.2.1: these errors are answered here.
    if (!client?.redirectUris.includes(redirectUri)) {
        return oauthError(400, 'invalid_request', 'Unknown client_id, or a redirect_uri it has not registered')
    }

    const state = query.get('state')
    const backWithError = (error: string, description: string) => {
        const url = new URL(redirectUri)
        url.searchParams.set('error', error)
        url.searchParams.set('error_description', description)
        if (state) url.searchParams.set('state', state)
        return NextResponse.redirect(url)
    }
    if (!state) return backWithError('invalid_request', 'state is required')
    if (query.get('response_type') !== 'code') {
        return backWithError('unsupported_response_type', 'Only the authorization code flow is supported')
    }
    const codeChallengeMethod = query.get('code_challenge_method')
    if (codeChallengeMethod !== 'S256') return backWithError('invalid_request', 'code_challenge_method must be S256')

    const token = await readSessionToken(request)
    if (!token) {
        // The client may name the site whose layout the login renders in, among those it serves.
        const requestedSite = siteNameSchema.safeParse(query.get('site'))
        const site = requestedSite.success && client.rendersSite(Site.of(requestedSite.data))
            ? Site.of(requestedSite.data)
            : client.site
        const here = appHref(`${request.nextUrl.pathname}${request.nextUrl.search}`)
        const form = authLinks(authPagesOf(site)).loginForm({ callbackUrl: here })
        return NextResponse.redirect(DomainContext.authDomainUrl(form))
    }

    try {
        const { code } = await oidcOperations.issueCode({
            params: {
                userId: token.user.id,
                clientId,
                redirectUri,
                scope: query.get('scope') ?? '',
                nonce: query.get('nonce'),
                codeChallenge: query.get('code_challenge') ?? '',
                codeChallengeMethod,
                provider: token.provider,
            },
            session: Session.fromJsObject({
                user: token.user,
                permissions: token.permissions,
                memberships: token.memberships,
            }),
        })
        const url = new URL(redirectUri)
        url.searchParams.set('code', code)
        url.searchParams.set('state', state)
        return NextResponse.redirect(url)
    } catch (error) {
        if (error instanceof Smorekopp) {
            const code = error.errorCode === 'BAD PARAMETERS' ? 'invalid_request' : 'server_error'
            return backWithError(code, describeError(error.errors))
        }
        throw error
    }
})
