import { generateJWT, verifyJWT } from '@/lib/jwt/jwt'
import { JWT_ISSUER, OmegaJWTAudienceFields } from '@/lib/jwt/constants'
import { readPemEnvBase64 } from '@/lib/jwt/readPemEnvBase64'
import { describe, expect, test } from '@jest/globals'
import { sign } from 'jsonwebtoken'
import { createHmac } from 'crypto'

const invalid = { errorCode: 'JWT INVALID' }

function base64Url(value: object) {
    return Buffer.from(JSON.stringify(value)).toString('base64url')
}

describe('verifyJWT', () => {
    test.each(OmegaJWTAudienceFields)('accepts a token generated for %s', audience => {
        const token = generateJWT(audience, { sub: 1 }, 60)

        expect(verifyJWT(token, audience)).toMatchObject({ sub: 1, aud: audience, iss: JWT_ISSUER })
    })

    test('rejects a token generated for another audience', () => {
        const token = generateJWT('verifyemail', { sub: 1 }, 60)

        expect(() => verifyJWT(token, 'resetpassword')).toThrow(expect.objectContaining(invalid))
    })

    test('rejects a token without an audience', () => {
        const secret = process.env.JWT_SECRET ?? ''
        const token = sign({ sub: 1 }, secret, { algorithm: 'HS256', issuer: JWT_ISSUER, expiresIn: 60 })

        expect(() => verifyJWT(token, 'resetpassword')).toThrow(expect.objectContaining(invalid))
    })

    test('rejects a symmetric token for an asymmetric audience', () => {
        const secret = process.env.JWT_SECRET ?? ''
        const token = sign({ sub: 1 }, secret, {
            algorithm: 'HS256',
            audience: 'omegaid',
            issuer: JWT_ISSUER,
            expiresIn: 60,
        })

        expect(() => verifyJWT(token, 'omegaid')).toThrow(expect.objectContaining(invalid))
    })

    test('rejects a token signed with the public key as an HMAC secret', () => {
        const publicKey = readPemEnvBase64(process.env.JWT_PUBLIC_KEY ?? '')
        const now = Math.floor(Date.now() / 1000)
        const unsigned = `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({
            sub: 1,
            aud: 'omegaid',
            iss: JWT_ISSUER,
            iat: now,
            exp: now + 60,
        })}`
        const signature = createHmac('sha256', publicKey).update(unsigned).digest('base64url')

        expect(() => verifyJWT(`${unsigned}.${signature}`, 'omegaid')).toThrow(expect.objectContaining(invalid))
    })
})
