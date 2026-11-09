import '@pn-server-only'
import { OIDC_TOKEN_LIFETIME_S, oidcIssuer } from './constants'
import { readPemEnvBase64 } from '@/lib/jwt/readPemEnvBase64'
import { ServiceError } from '@/services/error'
import { TokenExpiredError, sign, verify } from 'jsonwebtoken'
import { createHash, createPublicKey, randomBytes } from 'node:crypto'
import type { UserClaims } from './claims'

/**
 * The tokens of the provider, signed with the Omega ID key pair (JWT_PRIVATE_KEY and JWT_PUBLIC_KEY):
 * one key the clients already trust, published at the JWKS endpoint so they can verify what they
 * are handed.
 */

const ALGORITHM = 'ES256'

function keyFromEnv(name: 'JWT_PRIVATE_KEY' | 'JWT_PUBLIC_KEY'): string {
    const value = process.env[name]
    if (!value) {
        throw new ServiceError('INVALID CONFIGURATION', `${name} is not set, and the OpenID Connect provider signs with it`)
    }
    return readPemEnvBase64(value)
}

type EcJwk = { kty: string, crv: string, x: string, y: string }

/** The public key as a JWK, with the thumbprint of RFC 7638 as its id, so a client can find the key a token names. */
export function signingJwk() {
    const jwk = createPublicKey(keyFromEnv('JWT_PUBLIC_KEY')).export({ format: 'jwk' }) as EcJwk
    const thumbprint = createHash('sha256')
        .update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }))
        .digest('base64url')
    return { ...jwk, kid: thumbprint, use: 'sig', alg: ALGORITHM }
}

/** The document at the JWKS endpoint, see RFC 7517. */
export function jwks() {
    return { keys: [signingJwk()] }
}

export type IdTokenInput = {
    clientId: string,
    userId: number,
    /** The nonce the client sent with its request, repeated so it can tie the token to that request. */
    nonce: string | null,
    /** The claims the scopes gave, see {@link userClaims}. */
    claims: UserClaims,
}

/** The ID token of OpenID Connect Core section 2: who signed in, for the client alone. */
export function signIdToken({ clientId, userId, nonce, claims }: IdTokenInput): string {
    return sign({ ...claims, ...(nonce ? { nonce } : {}) }, keyFromEnv('JWT_PRIVATE_KEY'), {
        algorithm: ALGORITHM,
        keyid: signingJwk().kid,
        issuer: oidcIssuer(),
        audience: clientId,
        subject: String(userId),
        expiresIn: OIDC_TOKEN_LIFETIME_S,
    })
}

export type AccessTokenInput = {
    clientId: string,
    userId: number,
    scopes: readonly string[],
    /** The claims the scopes gave, see {@link userClaims}, carried so a resource server need not ask userinfo. */
    claims?: UserClaims,
}

/**
 * An access token shaped as RFC 9068 has it, for the userinfo endpoint and for the mail server,
 * which takes a token the webmail got for the mailboxes. Its audiences are the provider and the
 * client it was issued to, which is what the mail server is told to accept.
 */
export function signAccessToken({ clientId, userId, scopes, claims = {} }: AccessTokenInput): string {
    return sign({ ...claims, scope: scopes.join(' '), client_id: clientId }, keyFromEnv('JWT_PRIVATE_KEY'), {
        algorithm: ALGORITHM,
        keyid: signingJwk().kid,
        issuer: oidcIssuer(),
        audience: [oidcIssuer(), clientId],
        subject: String(userId),
        expiresIn: OIDC_TOKEN_LIFETIME_S,
        jwtid: randomBytes(16).toString('base64url'),
        header: { alg: ALGORITHM, typ: 'at+jwt' },
    })
}

export type AccessToken = {
    userId: number,
    clientId: string,
    scopes: string[],
}

/** What a bearer token the provider signed says, or a JWT EXPIRED or JWT INVALID error. */
export function verifyAccessToken(token: string): AccessToken {
    try {
        const payload = verify(token, keyFromEnv('JWT_PUBLIC_KEY'), {
            algorithms: [ALGORITHM],
            issuer: oidcIssuer(),
            audience: oidcIssuer(),
        })
        if (typeof payload === 'string' || !payload.sub) throw new ServiceError('JWT INVALID', 'The token has no subject')
        return {
            userId: Number(payload.sub),
            clientId: String(payload.client_id),
            scopes: String(payload.scope ?? '').split(' ').filter(Boolean),
        }
    } catch (error) {
        if (error instanceof TokenExpiredError) throw new ServiceError('JWT EXPIRED', error.message)
        // Whatever else verifying throws, a wrong signature or one that is not even the right length, is the bearer's.
        throw new ServiceError('JWT INVALID', error instanceof Error ? error.message : 'The token could not be verified')
    }
}
