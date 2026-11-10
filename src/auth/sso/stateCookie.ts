import '@pn-server-only'
import { SSO_STATE_MAX_AGE_S } from './constants'
import { generateJWT, verifyJWT } from '@/lib/jwt/jwt'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { z } from 'zod'
import { createHash, randomBytes } from 'node:crypto'
import type { AppHref } from '@/lib/sites/href'
import type { NextResponse } from 'next/server'

/**
 * What a site remembers between sending the browser to the auth domain and its coming back: the
 * state that ties the answer to this request, RFC 6749 section 10.12, the PKCE verifier of RFC
 * 7636, the nonce the ID token repeats, and where the visitor was going.
 */
export type SsoState = {
    state: string,
    codeVerifier: string,
    nonce: string,
    callbackUrl: AppHref,
}

const stateSchema = z.object({
    state: z.string().min(1),
    codeVerifier: z.string().min(1),
    nonce: z.string().min(1),
    callbackUrl: z.string(),
})

/** The cookie the state travels in, `__Host-` prefixed on https so no other host can set it. */
export const ssoCookieOf = (secure: boolean) => ({ name: secure ? '__Host-omega-sso' : 'omega-sso', secure })

const random = () => randomBytes(32).toString('base64url')

export function newSsoState(callbackUrl: AppHref): SsoState {
    return { state: random(), codeVerifier: random(), nonce: random(), callbackUrl }
}

/** The S256 challenge of a verifier, which the provider checks the verifier against. */
export function codeChallengeOf(codeVerifier: string): string {
    return createHash('sha256').update(codeVerifier).digest('base64url')
}

/** Puts the state on the response, signed, for this one sign in. */
export function setSsoStateCookie(response: NextResponse, secure: boolean, state: SsoState): void {
    response.cookies.set(ssoCookieOf(secure).name, generateJWT('sso', state, SSO_STATE_MAX_AGE_S), {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: SSO_STATE_MAX_AGE_S,
    })
}

/** The state a cookie holds, or null for no cookie, a tampered one or one too old. */
export function readSsoStateCookie(value: string | undefined): SsoState | null {
    if (!value) return null
    try {
        const parsed = stateSchema.safeParse(verifyJWT(value, 'sso'))
        if (!parsed.success) return null
        const callbackUrl = QueryParams.callbackUrl.decodeValue(parsed.data.callbackUrl)
        return callbackUrl ? { ...parsed.data, callbackUrl } : null
    } catch {
        return null
    }
}

export function clearSsoStateCookie(response: NextResponse, secure: boolean): void {
    response.cookies.set(ssoCookieOf(secure).name, '', { maxAge: 0, path: '/', httpOnly: true, secure, sameSite: 'lax' })
}
