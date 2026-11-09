import '@pn-server-only'
import { oidcAuth } from './auth'
import { loginProviderSchema, oidcSchemas } from './schemas'
import { oidcClientOf } from './clients'
import { OIDC_CODE_LIFETIME_MS } from './constants'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { createHash, randomBytes } from 'node:crypto'

/** Codes and verifiers are stored and compared hashed, as base64url, which is how a PKCE challenge is written. */
const hashOf = (value: string) => createHash('sha256').update(value).digest('base64url')

export const oidcOperations = {
    /**
     * A code for the signed in user, which the client exchanges for tokens at the token endpoint. The
     * client and its redirect uri are checked here, before anything is sent to that uri. The code
     * is stored hashed, with what the exchange must match, and lives OIDC_CODE_LIFETIME_MS.
     */
    issueCode: defineOperation({
        paramsSchema: oidcSchemas.params.issueCode,
        authorizer: ({ params }) => oidcAuth.issueCode.data({ userId: params.userId }),
        operation: async ({ params, prisma }) => {
            const client = oidcClientOf(params.clientId)
            if (!client) throw new ServiceError('BAD PARAMETERS', 'Ukjent klient')
            if (!client.redirectUris.includes(params.redirectUri)) {
                throw new ServiceError('BAD PARAMETERS', 'Klienten har ingen slik redirect_uri')
            }
            // Expired codes are no use to anyone, so each new one sweeps them out.
            await prisma.oidcAuthorizationCode.deleteMany({ where: { expiresAt: { lt: new Date() } } })
            const code = randomBytes(32).toString('base64url')
            await prisma.oidcAuthorizationCode.create({
                data: {
                    codeHash: hashOf(code),
                    userId: params.userId,
                    provider: params.provider,
                    clientId: client.id,
                    redirectUri: params.redirectUri,
                    scope: params.scope.join(' '),
                    nonce: params.nonce,
                    codeChallenge: params.codeChallenge,
                    expiresAt: new Date(Date.now() + OIDC_CODE_LIFETIME_MS),
                },
            })
            return { code }
        },
    }),

    /**
     * The user a code was issued to, for the client that got it. The code is deleted as it is read,
     * in the one statement, so it is good once however many exchange it at the same time. A code that
     * is unknown, used, expired, another client's, sent to another uri or not proved by its verifier
     * is refused alike, so a refusal tells nothing about which.
     */
    exchangeCode: defineOperation({
        paramsSchema: oidcSchemas.params.exchangeCode,
        authorizer: () => oidcAuth.exchangeCode,
        operation: async ({ params, prisma }) => {
            const stored = await prisma.oidcAuthorizationCode.delete({
                where: { codeHash: hashOf(params.code) },
            }).catch((error: unknown) => {
                if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') return null
                throw error
            })
            const valid = stored !== null
                && stored.expiresAt.getTime() > Date.now()
                && stored.clientId === params.clientId
                && stored.redirectUri === params.redirectUri
                && stored.codeChallenge === hashOf(params.codeVerifier)
            if (!valid) throw new ServiceError('DISSALLOWED', 'Koden er ukjent, brukt, utløpt eller ikke klientens')
            return {
                userId: stored.userId,
                provider: loginProviderSchema.parse(stored.provider),
                clientId: stored.clientId,
                scopes: stored.scope.split(' '),
                nonce: stored.nonce,
            }
        },
    }),
} as const
