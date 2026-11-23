import { authOptions, loginProvidersOn } from '@/auth/nextAuth/authOptions'
import { domainContextOf } from '@/app/domainContextOfRequest'
import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'

type RouteContext = { params: Promise<{ nextauth: string[] }> }

/** NextAuth on the domain the request came to, offering the logins of that domain alone. */
function handler(request: NextRequest, context: RouteContext) {
    const providers = loginProvidersOn(domainContextOf(request))
    // next-auth v4 types the handler as any
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return NextAuth(request, context, { ...authOptions, providers })
}

export { handler as GET, handler as POST }
