import '@pn-server-only'
import { authOptions } from '@/auth/nextAuth/authOptions'
import { sessionCookieChunks, sessionCookieNamesAmong, sessionCookieOf } from '@/auth/nextAuth/sessionCookie'
import { sessionTokenOf } from '@/auth/nextAuth/sessionToken'
import { Session } from '@/auth/session/Session'
import { getToken } from 'next-auth/jwt'
import type { AnySession } from '@/auth/session/Session'
import type { UserLoginProvider } from '@/auth/nextAuth/sessionToken'
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
export async function sessionFromCookie(request: NextRequest): Promise<AnySession> {
    const token = await readSessionToken(request)
    if (!token) return Session.empty()
    return Session.fromToken(token)
}

/**
 * Writes the session cookie of the domain the request came to, or clears it for a null value. A
 * token with many memberships is larger than a browser takes in one cookie, so it is written the
 * way NextAuth writes it, in chunks, and every cookie the request held of an earlier session that
 * the new one does not use is cleared with it.
 */
function setSessionCookie(response: NextResponse, request: Request, value: string | null): void {
    const cookie = sessionCookieOf(request.headers)
    const options = { httpOnly: true, secure: cookie.secure, sameSite: 'lax', path: '/' } as const
    const written = value === null ? [] : sessionCookieChunks(cookie.name, value)
    const cookieNames = (request.headers.get('cookie') ?? '').split(';').map(pair => pair.split('=')[0].trim())
    const held = sessionCookieNamesAmong(cookie.name, cookieNames)

    const stale = new Set(value === null ? [cookie.name, ...held] : held)
    written.forEach(chunk => stale.delete(chunk.name))
    stale.forEach(name => response.cookies.set(name, '', { ...options, maxAge: 0 }))
    written.forEach(chunk => response.cookies.set(chunk.name, chunk.value, {
        ...options,
        expires: new Date(Date.now() + SESSION_MAX_AGE_S * 1000),
    }))
}

/**
 * Starts a session on this domain for the user the auth domain signed in: the token NextAuth would
 * build at a sign in of its own, in the cookie NextAuth reads, so the rest of the app never knows
 * the difference.
 */
export async function startSession(
    response: NextResponse,
    request: Request,
    userId: number,
    provider: UserLoginProvider,
): Promise<void> {
    const encode = authOptions.jwt?.encode
    if (!encode) throw new Error('authOptions has no jwt encoder')
    const token = await sessionTokenOf(userId, provider)
    setSessionCookie(response, request, await encode({ token, secret: secret(), maxAge: SESSION_MAX_AGE_S }))
}

/** Ends the session on the domain the request came to, by clearing its cookie, chunks and all. */
export function endSession(response: NextResponse, request: Request): void {
    setSessionCookie(response, request, null)
}
