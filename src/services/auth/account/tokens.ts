import '@pn-server-only'
import { generateJWT } from '@/jwt/jwt'
import type { OmegaJWTAudience } from '@/lib/jwt/types'

/**
 * The token a password link carries: whose password it sets, and the email the link was sent to,
 * which lets the reset verify the address as well, since only its owner can follow the link.
 */
export function generateResetPasswordJWT(
    audience: OmegaJWTAudience,
    accountId: number,
    email: string,
    expiresIn: number,
) {
    return generateJWT(audience, { sub: accountId, email }, expiresIn)
}

/**
 * The token a verify email link carries. Verifying refuses a token issued before the account's
 * email was last verified, so the issue time keeps its milliseconds: a token made right after a
 * write is never older than it, and one made before a write in the same second never looks newer.
 * A JWT issue time may hold fractions of a second (RFC 7519, section 2).
 */
export function generateVerifyEmailJWT(
    audience: OmegaJWTAudience,
    accountId: number,
    email: string,
    expiresIn: number,
) {
    return generateJWT(audience, { sub: accountId, email, iat: Date.now() / 1000 }, expiresIn)
}
