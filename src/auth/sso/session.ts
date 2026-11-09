import '@pn-server-only'
import { authOptions } from '@/auth/nextAuth/authOptions'
import { sessionCookieOf } from '@/auth/nextAuth/sessionCookie'
import { sessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { Session } from '@/auth/session/Session'
import { getToken } from 'next-auth/jwt'
import type { LoginProvider } from '@/auth/nextAuth/sessionToken'
import type { JWT } from 'next-auth/jwt'
import type { NextRequest, NextResponse } from 'next/server'

/** NextAuth's default, which authOptions leaves as it is. */
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60

function secret(): string {
    if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is not set, and the session cookie is signed with it')
    return process.env.NEXTAUTH_SECRET
}

// Read once per request, however many of a route's hooks ask.
const tokensOfRequests = new WeakMap<Request, Promise<JWT | null>>()

/**
 * The session a request carries, as NextAuth reads it, checks and all: null when the visitor is
 * not signed in on the domain the request came to.
 */
export function readSessionToken(request: NextRequest): Promise<JWT | null> {
    const read = tokensOfRequests.get(request)
    if (read) return read
    const cookie = sessionCookieOf(request.headers)
    const token = getToken({
        req: request,
        secret: secret(),
        cookieName: cookie.name,
        secureCookie: cookie.secure,
        decode: authOptions.jwt?.decode,
    })
    tokensOfRequests.set(request, token)
    return token
}

/** The session of {@link readSessionToken} as the service operations take it, empty for a visitor not signed in. */
export async function sessionFromCookie(request: NextRequest): Promise<Session<'HAS_USER'> | Session<'NO_USER'>> {
    const token = await readSessionToken(request)
    if (!token) return Session.empty()
    return Session.fromJsObject({ user: token.user, permissions: token.permissions, memberships: token.memberships })
}

/**
 * Starts a session on this domain for the user the auth domain signed in: the token NextAuth would
 * build at a sign in of its own, in the cookie NextAuth reads, so the rest of the app never knows
 * the difference.
 */
export async function startSession(
    response: NextResponse,
    headers: Headers,
    userId: number,
    provider: LoginProvider,
): Promise<void> {
    const encode = authOptions.jwt?.encode
    if (!encode) throw new Error('authOptions has no jwt encoder')
    const cookie = sessionCookieOf(headers)
    const token = await sessionTokenOf(userId, provider)
    response.cookies.set(cookie.name, await encode({ token, secret: secret(), maxAge: SESSION_MAX_AGE_S }), {
        httpOnly: true,
        secure: cookie.secure,
        sameSite: 'lax',
        path: '/',
        expires: new Date(Date.now() + SESSION_MAX_AGE_S * 1000),
    })
}
