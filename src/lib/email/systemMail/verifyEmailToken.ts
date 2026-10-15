import '@pn-server-only'
import { generateJWT } from '@/jwt/jwt'

/**
 * The token a verify email link carries. verifyEmail refuses a token issued before the user row
 * was last written, so the issue time keeps its milliseconds: a token made right after a write
 * is never older than it, and one made before a write in the same second never looks newer. A
 * JWT issue time may hold fractions of a second (RFC 7519, section 2).
 */
export function generateVerifyEmailJWT(userId: number, email: string, expiresIn: number) {
    return generateJWT('verifyemail', {
        sub: userId,
        email,
        iat: Date.now() / 1000,
    }, expiresIn)
}
