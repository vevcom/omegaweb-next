import type { JWT } from './jwt'

/** Function for parsing a jwt.
 * WARNING! This function does not validate the signature!
 *
 * @param jwtString - The raw jwt.
 * @returns An object containing the jwt payload.
 */
export function readJWTPayload<T = Record<string, unknown>>(jwtString: string): JWT<T> {
    const payload = readJWTPart(jwtString, 1)

    if (!hasRegisteredClaims<T>(payload)) {
        throw new Error('Invalid JWT string')
    }

    return payload
}

/**
 * Checks the registered claims of a jwt payload. The claims of `T` are not checked, they are trusted.
 */
function hasRegisteredClaims<T>(payload: unknown): payload is JWT<T> {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        'iss' in payload && typeof payload.iss === 'string' &&
        'aud' in payload && typeof payload.aud === 'string' &&
        'sub' in payload && (typeof payload.sub === 'number' || typeof payload.sub === 'string') &&
        'iat' in payload && typeof payload.iat === 'number' &&
        'exp' in payload && typeof payload.exp === 'number'
    )
}


/**
 * Reads a specific part of a JSON Web Token (JWT) string.
 * WARNING: This function does not validate the signature
 *
 * @param jwtString - The JWT string to read from.
 * @param part - The part of the JWT to read. Default is 1 (payload).
 * @returns The parsed JSON of the specified JWT part, unvalidated.
 */
export function readJWTPart(jwtString: string, part: 0 | 1 | 2 = 1): unknown {
    const parts = jwtString.split('.')
    const payload = new TextDecoder().decode(decodeBase64Url(parts[part]))
    return JSON.parse(payload)
}

/**
 * Decodes base64url - what the parts of a JWT are encoded in, with the padding left out - or plain
 * base64 into bytes. Uses only what both browsers and Node provide, so it works on either side.
 *
 * @param encoded - The base64url or base64 string to decode.
 * @returns The decoded bytes.
 */
export function decodeBase64Url(encoded: string): Uint8Array<ArrayBuffer> {
    const base64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return Uint8Array.from(atob(padded), character => character.charCodeAt(0))
}

