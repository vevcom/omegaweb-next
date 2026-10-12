import type { Algorithm } from 'jsonwebtoken'
import type { OmegaJWTAudience } from './types'

export const JWT_ISSUER = 'omegaveven'

export const OmegaJWTAudienceFields = [
    'resetpassword',
    'omegaid',
    'verifyemail',
    'linkfeideaccount',
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
} as const satisfies Record<OmegaJWTAudience, Algorithm>
