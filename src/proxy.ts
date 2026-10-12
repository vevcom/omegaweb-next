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
    return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
    // Static assets never read the header, so skip them.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|images/).*)'],
}
