import type { Algorithm } from 'jsonwebtoken'
import type { OmegaJWTAudience } from './types'

export const JWT_ISSUER = 'omegaveven'

export const OmegaJWTAudienceFields = [
    'resetpassword',
    'omegaid',
    'verifyemail',
    'linkfeideaccount',
    'sso',
    // The password and verify email links of a company user, apart from those of a user so a
    // token for one can never act on the other.
    'companyresetpassword',
    'companyverifyemail',
] as const

/**
 * The algorithm each audience is signed with. Verification accepts only this algorithm, never the
 * one a token names in its own header. OmegaId is asymmetric so clients can verify it with the
 * public key.
 */
export const OmegaJWTAudienceAlgorithms = {
    resetpassword: 'HS256',
    omegaid: 'ES256',
    verifyemail: 'HS256',
    linkfeideaccount: 'HS256',
    sso: 'HS256',
    companyresetpassword: 'HS256',
    companyverifyemail: 'HS256',
} as const satisfies Record<OmegaJWTAudience, Algorithm>
