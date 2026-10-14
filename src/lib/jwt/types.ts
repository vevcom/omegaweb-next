
import type { OmegaJWTAudienceFields } from './constants'


export type OmegaJWTAudience = typeof OmegaJWTAudienceFields[number]

/**
 * The registered claims every token of ours carries, see RFC 7519 section 4.1. `readJWTPayload`
 * checks a token for exactly these before it trusts its shape.
 */
export type OmegaJWTPayload = {
    iss: string,
    aud: string,
    sub: string | number,
    iat: number,
    exp: number,
}
