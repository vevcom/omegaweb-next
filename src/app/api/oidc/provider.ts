import '@pn-server-only'
import { domainContextOf } from '@/app/domainContextOfRequest'
import { Session } from '@/auth/session/Session'
import { NextResponse } from 'next/server'
import type { ApiError } from '@/api/apiHandler'
import type { ErrorCode, ErrorMessage } from '@/services/error'
import type { Awaitable } from '@/lib/awaitable'
import type { NextRequest } from 'next/server'

/** Tokens and claims are for the one who asked, RFC 6749 section 5.1. */
export const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
/** The documents change with a deploy at most. */
export const CACHED_FOR_AN_HOUR = { 'Cache-Control': 'public, max-age=3600' }

/**
 * The error a failure of the service answers with, as RFC 6749 section 5.2, OpenID Connect Core
 * section 3.1.2.6 and RFC 6750 section 3.1 name them. Anything else is a fault of ours.
 */
const oauthErrorCodes: Partial<Record<ErrorCode, string>> = {
    'BAD PARAMETERS': 'invalid_request',
    'BAD DATA': 'invalid_request',
    DISSALLOWED: 'invalid_grant',
    UNAUTHENTICATED: 'login_required',
    UNAUTHORIZED: 'access_denied',
    'JWT EXPIRED': 'invalid_token',
    'JWT INVALID': 'invalid_token',
}

/** A parameter the service refuses the value of has an error of its own, by the field the schema names it. */
const unsupportedValueErrors: Record<string, string> = {
    grantType: 'unsupported_grant_type',
    responseType: 'unsupported_response_type',
}

export type OauthError = {
    error: string,
    description: string,
}

/** The messages of a service error, as one description. */
export function describeError(errors: ErrorMessage[]): string {
    return errors.map(error => error.message).join('. ')
}

export function oauthErrorOf({ errorCode, errors }: ApiError): OauthError {
    const unsupported = errors.map(error => unsupportedValueErrors[String(error.path?.[0])]).find(Boolean)
    return { error: unsupported ?? oauthErrorCodes[errorCode] ?? 'server_error', description: describeError(errors) }
}

/** The error answer of RFC 6749 section 5.2: a JSON body, 400 for the client's mistakes and 500 for ours. */
export function oauthErrorResponse(apiError: ApiError): Response {
    const { error, description } = oauthErrorOf(apiError)
    return NextResponse.json(
        { error, error_description: description },
        { status: error === 'server_error' ? 500 : 400, headers: NO_STORE },
    )
}

/** A result as JSON with the headers given, for the documents and the tokens. */
export const jsonWith = (headers: Record<string, string>) => (result: unknown) => NextResponse.json(result, { headers })

/** For the endpoints no session takes part in, so none is looked up. */
export const noSession = () => Promise.resolve(Session.empty())

type RouteHandler = (request: NextRequest, context?: { params: Promise<unknown> }) => Awaitable<Response>

/**
 * The provider answers on the auth domain alone, where the session it works on lives, so a request
 * to one of its endpoints anywhere else finds nothing there.
 */
export function providerRoute(handler: RouteHandler): RouteHandler {
    return (request, context) => {
        if (!domainContextOf(request).isAuthDomain()) {
            return new NextResponse('Not found', { status: 404, headers: { 'content-type': 'text/plain' } })
        }
        return handler(request, context)
    }
}
