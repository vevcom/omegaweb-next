import '@pn-server-only'
import { generateJWT } from '@/jwt/jwt'

/**
 * The token a verify email link carries. Tokens are issued in whole seconds, and verifyEmail
 * refuses one issued before the user row was last written, so the issue time is rounded up to
 * the next whole second: the token is always made after the write, but a rounded down time
 * would make one made in the same second look older than the row.
 */
export function generateVerifyEmailJWT(userId: number, email: string, expiresIn: number) {
    return generateJWT('verifyemail', {
        sub: userId,
        email,
        iat: Math.ceil(Date.now() / 1000),
    }, expiresIn)
}
