import { describeError, providerRoute } from '@/app/api/oidc/provider'
import { userClaims } from '@/services/auth/oidc/claims'
import { verifyAccessToken } from '@/services/auth/oidc/tokens'
import { Smorekopp } from '@/services/error'
import { NextResponse } from 'next/server'

/** The userinfo endpoint, OpenID Connect Core section 5.3: the claims of the user an access token is for. */
const handler = providerRoute(async request => {
    const bearer = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]
    if (!bearer) return new NextResponse(null, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } })
    try {
        const token = verifyAccessToken(bearer)
        return NextResponse.json({ sub: String(token.userId), ...await userClaims(token.userId, token.scopes) }, {
            headers: { 'Cache-Control': 'no-store' },
        })
    } catch (error) {
        if (error instanceof Smorekopp) {
            return new NextResponse(null, {
                status: 401,
                headers: {
                    'WWW-Authenticate': `Bearer error="invalid_token", error_description="${describeError(error.errors)}"`,
                },
            })
        }
        throw error
    }
})

export { handler as GET, handler as POST }
