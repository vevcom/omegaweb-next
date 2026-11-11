import '@pn-server-only'
import { oidcAuth } from './auth'
import { loginProviderSchema, oidcSchemas } from './schemas'
import { isPostLogoutRedirectUri, oidcClientOf } from './clients'
import { OIDC_CODE_LIFETIME_MS, OIDC_TOKEN_LIFETIME_S, oidcIssuer } from './constants'
import { userClaims } from './scopes'
import { discoveryDocument } from './discovery'
import { jwks, signAccessToken, signIdToken, verifyAccessToken } from './tokens'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { createHash, randomBytes } from 'node:crypto'
import type { Prisma } from '@/prisma-generated-pn-client'
import type { z } from 'zod'

/** Codes and verifiers are stored and compared hashed, as base64url, which is how a PKCE challenge is written. */
const hashOf = (value: string) => createHash('sha256').update(value).digest('base64url')

type ExchangeParams = z.output<typeof oidcSchemas.params.exchangeCode>

/**
 * The user a code was issued to, for the client that got it. The code is deleted as it is read, in
 * the one statement, so it is good once however many exchange it at the same time. A code that is
 * unknown, used, expired, another client's, sent to another uri or not proved by its verifier is
 * refused alike, so a refusal tells nothing about which.
 */
async function redeemCode(prisma: Prisma.TransactionClient, params: ExchangeParams) {
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
}

export const oidcOperations = {
    /**
     * The authorization request, RFC 6749 section 4.1.1: a code for the signed in user, which the
     * client exchanges for tokens at the token endpoint. The client and its redirect uri are checked
     * here, before anything is sent to that uri, and the scopes are cut to those the client may
     * have. The code is stored hashed, with what the exchange must match, and lives
     * OIDC_CODE_LIFETIME_MS. The answer is where to send the browser: back to the client with the
     * code and its state.
     */
    issueCode: defineOperation({
        paramsSchema: oidcSchemas.params.issueCode,
        authorizer: ({ params }) => oidcAuth.issueCode.data({ userId: params.userId }),
        operation: async ({ params, prisma }) => {
            const client = oidcClientOf(params.clientId)
            if (!client) throw new ServiceError('BAD PARAMETERS', 'Ukjent klient')
            if (!client.acceptsRedirectUri(params.redirectUri)) {
                throw new ServiceError('BAD PARAMETERS', 'Klienten har ingen slik redirect_uri')
            }
            const scopes = params.scope.filter(scope => client.scopes.includes(scope))
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
                    scope: scopes.join(' '),
                    nonce: params.nonce,
                    codeChallenge: params.codeChallenge,
                    expiresAt: new Date(Date.now() + OIDC_CODE_LIFETIME_MS),
                },
            })
            return { code, state: params.state, redirectUri: params.redirectUri }
        },
    }),

    /**
     * The grant a code stands for, see {@link redeemCode}, for a client of this app's own, which
     * starts a session from it rather than taking tokens.
     */
    exchangeCode: defineOperation({
        paramsSchema: oidcSchemas.params.exchangeCode,
        authorizer: () => oidcAuth.exchangeCode,
        operation: ({ params, prisma }) => redeemCode(prisma, params),
    }),

    /**
     * The token request, RFC 6749 section 4.1.3: the client trades the code it was sent, proving it
     * with its PKCE verifier, for the token response of section 5.1: an ID token saying who signed
     * in and an access token for userinfo, which the webmail also hands the mail server.
     */
    token: defineOperation({
        dataSchema: oidcSchemas.data.token,
        authorizer: () => oidcAuth.token,
        operation: async ({ data, prisma }) => {
            const grant = await redeemCode(prisma, data)
            const claims = await userClaims(grant.userId, grant.scopes)
            const identity = { clientId: grant.clientId, userId: grant.userId }
            return {
                access_token: signAccessToken({ ...identity, scopes: grant.scopes, claims }),
                token_type: 'Bearer',
                expires_in: OIDC_TOKEN_LIFETIME_S,
                scope: grant.scopes.join(' '),
                id_token: signIdToken({ ...identity, nonce: grant.nonce, claims }),
            }
        },
    }),

    /** The userinfo response, OpenID Connect Core section 5.3: the claims of the user an access token is for. */
    userinfo: defineOperation({
        paramsSchema: oidcSchemas.params.userinfo,
        authorizer: () => oidcAuth.userinfo,
        operation: async ({ params }) => {
            const token = verifyAccessToken(params.accessToken)
            return { sub: String(token.userId), ...await userClaims(token.userId, token.scopes) }
        },
    }),

    /**
     * Where a logged out visitor goes, RP-Initiated Logout section 2: the uri the client asked for
     * when it is one of ours, the provider's own frontpage otherwise.
     */
    endSession: defineOperation({
        paramsSchema: oidcSchemas.params.endSession,
        authorizer: () => oidcAuth.endSession,
        operation: ({ params }) => ({
            redirectTo: params.postLogoutRedirectUri && isPostLogoutRedirectUri(params.postLogoutRedirectUri)
                ? params.postLogoutRedirectUri
                : `${oidcIssuer()}/`,
        }),
    }),

    /** The discovery document, see discovery.ts. */
    discovery: defineOperation({
        authorizer: () => oidcAuth.discovery,
        operation: () => discoveryDocument(),
    }),

    /** The key set the tokens are verified with, see tokens.ts. */
    jwks: defineOperation({
        authorizer: () => oidcAuth.jwks,
        operation: () => jwks(),
    }),
} as const
