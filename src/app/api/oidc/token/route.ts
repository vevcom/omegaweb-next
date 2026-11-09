import { describeError, oauthError, providerRoute } from '@/app/api/oidc/provider'
import { oidcOperations } from '@/services/auth/oidc/operations'
import { userClaims } from '@/services/auth/oidc/claims'
import { signAccessToken, signIdToken } from '@/services/auth/oidc/tokens'
import { OIDC_TOKEN_LIFETIME_S } from '@/services/auth/oidc/constants'
import { Smorekopp } from '@/services/error'
import { NextResponse } from 'next/server'

/**
 * The token endpoint, RFC 6749 section 4.1.3: the client trades the code it was sent, proving it
 * with its PKCE verifier, for an ID token saying who signed in and an access token for userinfo.
 */
export const POST = providerRoute(async request => {
    const form = await request.formData().catch(() => null)
    if (!form) return oauthError(400, 'invalid_request', 'The body is application/x-www-form-urlencoded')
    const field = (name: string) => {
        const value = form.get(name)
        return typeof value === 'string' ? value : ''
    }
    if (field('grant_type') !== 'authorization_code') {
        return oauthError(400, 'unsupported_grant_type', 'Only authorization_code is supported')
    }

    try {
        const grant = await oidcOperations.exchangeCode({
            params: {
                clientId: field('client_id'),
                redirectUri: field('redirect_uri'),
                code: field('code'),
                codeVerifier: field('code_verifier'),
            },
        })
        const claims = await userClaims(grant.userId, grant.scopes)
        return NextResponse.json({
            access_token: signAccessToken({ clientId: grant.clientId, userId: grant.userId, scopes: grant.scopes }),
            token_type: 'Bearer',
            expires_in: OIDC_TOKEN_LIFETIME_S,
            scope: grant.scopes.join(' '),
            id_token: signIdToken({ clientId: grant.clientId, userId: grant.userId, nonce: grant.nonce, claims }),
        }, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } })
    } catch (error) {
        if (error instanceof Smorekopp) {
            const code = error.errorCode === 'DISSALLOWED' ? 'invalid_grant' : 'invalid_request'
            return oauthError(400, code, describeError(error.errors))
        }
        throw error
    }
})
