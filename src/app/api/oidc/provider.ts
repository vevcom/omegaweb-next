import '@pn-server-only'
import { domainContextOfRequest } from '@/app/domainContextOfRequest'
import { NextResponse } from 'next/server'
import type { ErrorMessage } from '@/services/error'
import type { Awaitable } from '@/lib/awaitable'
import type { NextRequest } from 'next/server'

/** An error answer, shaped as RFC 6749 section 5.2 has it. */
export function oauthError(status: number, error: string, description: string) {
    return NextResponse.json({ error, error_description: description }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** The messages of a service error, as one description. */
export function describeError(errors: ErrorMessage[]): string {
    return errors.map(error => error.message).join('. ')
}

/**
 * The provider answers on the auth domain alone, where the session it works on lives, so a request
 * to one of its endpoints anywhere else finds nothing there.
 */
export function providerRoute(handler: (request: NextRequest) => Awaitable<Response>) {
    return async (request: NextRequest) => {
        if (!(await domainContextOfRequest()).isAuthDomain()) {
            return new NextResponse('Not found', { status: 404, headers: { 'content-type': 'text/plain' } })
        }
        return handler(request)
    }
}
