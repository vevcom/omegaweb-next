import '@pn-server-only'
import { readPemEnvBase64 } from './readPemEnvBase64'
import { JWT_ISSUER, OmegaJWTAudienceAlgorithms } from '@/lib/jwt/constants'
import { ServiceError } from '@/services/error'
import { JsonWebTokenError, TokenExpiredError, sign, verify } from 'jsonwebtoken'
import type jwt from 'jsonwebtoken'
import type { JwtPayloadType } from './validation'
import type { OmegaJWTAudience } from '@/lib/jwt/types'


// See https://www.rfc-editor.org/rfc/rfc7519#section-4.1 for the
// JWT payload specification.
export type JWT<T = Record<string, unknown>> = T & JwtPayloadType['Detailed']

/**
 * Generates a JSON Web Token (JWT) with the given payload and expiration time.
 * The audience decides the algorithm, see `OmegaJWTAudienceAlgorithms`. An asymmetric token is
 * signed with the private key and can be verified with the public key, which is available to all users.
 * @param aud - An audience for the token, this is the purpose of the token
 * @param payload - The payload to be included in the JWT.
 * @param expiresIn - The expiration time of the JWT in seconds.
 * @returns The generated JWT.
 */
export function generateJWT<T extends object>(
    aud: OmegaJWTAudience,
    payload: T,
    expiresIn: number,
): string {
    if (!process.env.JWT_SECRET || !process.env.JWT_PRIVATE_KEY) {
        throw new ServiceError('INVALID CONFIGURATION', 'Missing secret for JWT generation')
    }

    const algorithm = OmegaJWTAudienceAlgorithms[aud]

    return sign(payload, algorithm === 'ES256' ? readPemEnvBase64(process.env.JWT_PRIVATE_KEY) : process.env.JWT_SECRET, {
        audience: aud,
        algorithm,
        issuer: JWT_ISSUER,
        expiresIn,
    })
}

/**
 * Verifies the authenticity of a JSON Web Token (JWT).
 * The token must carry the given audience and be signed with that audience's algorithm.
 * @param token - The JWT to be verified.
 * @param aud - The audience the token must have been generated for.
 * @returns The decoded payload of the JWT if it is valid.
 * @throws {ServiceError} If the JWT is expired or invalid.
 */
export function verifyJWT(token: string, aud: OmegaJWTAudience): (jwt.JwtPayload & Record<string, string | number | null>) {
    if (!process.env.JWT_SECRET || !process.env.JWT_PUBLIC_KEY) {
        throw new ServiceError(
            'INVALID CONFIGURATION',
            'JWT environ variables is not set. Missing JWT_SECRET or JWT_PUBLIC_KEY'
        )
    }

    const algorithm = OmegaJWTAudienceAlgorithms[aud]

    try {
        const jwtKey = algorithm === 'ES256' ? readPemEnvBase64(process.env.JWT_PUBLIC_KEY) : process.env.JWT_SECRET

        const payload = verify(token, jwtKey, {
            algorithms: [algorithm],
            issuer: JWT_ISSUER,
            ignoreExpiration: false,
            audience: aud,
        })

        if (typeof payload === 'string') {
            throw new ServiceError('JWT INVALID', 'The payload cannot be a string')
        }

        return payload
    } catch (err) {
        if (err instanceof TokenExpiredError) {
            throw new ServiceError('JWT EXPIRED', err.message)
        } else if (err instanceof JsonWebTokenError) {
            throw new ServiceError('JWT INVALID', err.message)
        } else {
            throw err
        }
    }
}
