'use client'

import { decodeBase64Url, readJWTPayload } from './jwtReadUnsecure'
import { createActionError } from '@/services/actionError'
import { JWT_ISSUER } from '@/lib/jwt/constants'
import type { OmegaJWTAudience } from '@/lib/jwt/types'
import type { ActionReturn } from '@/services/actionTypes'

/**
 * Parses a JSON Web Token (JWT) and verifies its signature using the provided public key.
 * WARNING: This function should only be used at the client, and never at the server
 * @param token - The JWT to parse and verify.
 * @param publicKey - The public key used to verify the JWT signature.
 * @param timeOffset - The time offset in milliseconds to account for clock differences.
 * @returns A promise that resolves to an `ActionReturn` object containing the parsed JWT payload if the JWT is valid,
 * or an error object if the JWT is invalid.
 */
export async function parseJWTClient(
    token: string,
    publicKey: string,
    timeOffset: number,
    audience: OmegaJWTAudience
): Promise<ActionReturn<number>> {
    function invalidJWT(message?: string): ActionReturn<number> {
        return createActionError('JWT INVALID', message || 'Invalid JWT')
    }

    if (timeOffset < 0) {
        throw new Error('The timeOffset cannot be below 0')
    }


    const tokenS = token.split('.')
    if (tokenS.length !== 3) {
        return invalidJWT('Malformatted JWT')
    }

    const keyStripped = publicKey
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s/g, '')

    // Decoding and Web Crypto throw on malformed input. A scanned token must still come back as a
    // result the reader can show, never as a rejected promise.
    let signValid: boolean
    try {
        const key = await crypto.subtle.importKey(
            'spki', // Subject Public Key Info
            decodeBase64Url(keyStripped),
            {
                name: 'ECDSA',
                namedCurve: 'P-256',
            },
            true,
            ['verify']
        )

        signValid = await crypto.subtle.verify(
            {
                name: 'ECDSA',
                hash: 'SHA-256'
            },
            key,
            decodeBase64Url(tokenS[2]),
            new TextEncoder().encode(`${tokenS[0]}.${tokenS[1]}`),
        )
    } catch {
        return invalidJWT('Malformatted JWT')
    }

    if (!signValid) {
        return invalidJWT('Invalid JWT signature')
    }

    try {
        const payload = readJWTPayload(token)

        if (typeof payload.sub !== 'number') {
            return invalidJWT('JWT is missing sub field')
        }

        if (new Date(payload.exp * 1000 + timeOffset) < new Date()) {
            return invalidJWT('JWT has expired')
        }

        if (payload.iss !== JWT_ISSUER) {
            return invalidJWT('Invalid issuer')
        }

        if (payload.aud !== audience) {
            return invalidJWT('Invalid audience')
        }

        return {
            success: true,
            data: payload.sub
        }
    } catch {
        return invalidJWT('An unexpected error occured')
    }
}
