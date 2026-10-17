import { contentSecurityPolicy } from '@/lib/securityHeaders'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * The header the proxy stamps the requested path (including query string) into.
 * Server components cannot read their own URL, so anything that needs it - like
 * serverPage building a login callbackUrl - reads this header instead.
 */
export const CURRENT_PATH_HEADER = 'x-current-path'

export function proxy(request: NextRequest) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(CURRENT_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search)

    // Uploaded files keep the stricter policy their route sets: a sandbox, so a stored file never runs.
    if (request.nextUrl.pathname.startsWith('/store/')) {
        return NextResponse.next({ request: { headers: requestHeaders } })
    }

    const nonce = btoa(crypto.randomUUID())
    const policy = contentSecurityPolicy(nonce, { development: process.env.NODE_ENV === 'development' })
    // Next.js finds the nonce in the request's policy and puts it on the scripts it renders.
    requestHeaders.set('Content-Security-Policy', policy)

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Content-Security-Policy', policy)
    return response
}

export const config = {
    // Static assets never read the header, so skip them.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|images/).*)'],
}
