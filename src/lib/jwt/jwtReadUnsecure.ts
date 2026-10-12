import type { JWT } from './jwt'

/** Function for parsing a jwt.
 * WARNING! This function does not validate the signature!
 *
 * @param jwtString - The raw jwt.
 * @returns An object containing the jwt payload.
 */
export function readJWTPayload<T = Record<string, unknown>>(jwtString: string): JWT<T> {
    const payload = readJWTPart(jwtString, 1)

    if (!(
        payload &&
        typeof payload === 'object' &&
        typeof payload.iss === 'string' &&
        typeof payload.aud === 'string' &&
        (typeof payload.sub === 'number' || typeof payload.sub === 'string') &&
        typeof payload.iat === 'number' &&
        typeof payload.exp === 'number'
    )) {
        throw new Error('Invalid JWT string')
    }

    return payload
}


/**
 * Reads a specific part of a JSON Web Token (JWT) string.
 * WARNING: This function does not validate the signature
 *
 * @param jwtString - The JWT string to read from.
 * @param part - The part of the JWT to read. Default is 1 (payload).
 * @returns The parsed JSON object of the specified JWT part.
 */
export function readJWTPart(jwtString: string, part: 0 | 1 | 2 = 1) {
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

