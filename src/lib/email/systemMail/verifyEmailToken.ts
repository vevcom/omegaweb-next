import '@pn-server-only'
import { generateVerifyEmailJWT as generateVerifyEmailJWTOfAccount } from '@/services/auth/account/tokens'

/** The token the verify email link of a user carries. See the generator shared by every kind of account. */
export function generateVerifyEmailJWT(userId: number, email: string, expiresIn: number) {
    return generateVerifyEmailJWTOfAccount('verifyemail', userId, email, expiresIn)
}
