import { authOptions } from '@/auth/nextAuth/authOptions'
import { domainContextOf } from '@/app/domainContextOfRequest'
import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'

type RouteContext = { params: Promise<{ nextauth: string[] }> }

/**
 * Credentials and Feide sign in on the auth domain alone. A site's domain gets its session from
 * the SSO callback, and NextAuth there only reads and ends it, so it is offered no providers.
 */
function handler(request: NextRequest, context: RouteContext) {
    const providers = domainContextOf(request).isAuthDomain() ? authOptions.providers : []
    // next-auth v4 types the handler as any
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return NextAuth(request, context, { ...authOptions, providers })
}

export { handler as GET, handler as POST }
