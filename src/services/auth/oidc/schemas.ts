import { OIDC_SCOPES } from './constants'
import { z } from 'zod'
import type { OidcScope } from './constants'

const isScope = (scope: string): scope is OidcScope => (OIDC_SCOPES as readonly string[]).includes(scope)

/** The login a session on the auth domain came from, as the NextAuth token names it. */
export const loginProviderSchema = z.enum(['credentials', 'feide'])

/** The parameters of the protocol, as the client sends them, see RFC 6749 and OpenID Connect Core. */
const paramsFieldSchemas = z.object({
    /** The user the code is for, who is the one signed in. */
    userId: z.number().int(),
    clientId: z.string().min(1),
    redirectUri: z.string().url(),
    /** The one flow there is, RFC 6749 section 4.1. */
    responseType: z.string().refine(value => value === 'code', 'Only the authorization code flow is supported'),
    /** The scopes asked for, space separated. Unknown ones are ignored, as section 3.1.2.1 says; `openid` must be there. */
    scope: z.string()
        .transform(scope => scope.split(' ').filter(isScope))
        .refine(scopes => scopes.includes('openid'), 'An OpenID Connect request asks for the openid scope'),
    /** The client's own value, which it gets back with the code and ties the answer to its request by. */
    state: z.string().min(1, 'state is required'),
    nonce: z.string().min(1).nullable(),
    /** The S256 challenge, RFC 7636: the base64url sha256 of the verifier, which is 43 characters. */
    codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'The code challenge is the base64url sha256 of the verifier'),
    codeChallengeMethod: z.string().refine(value => value === 'S256', 'code_challenge_method must be S256'),
    codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/, 'A code verifier is 43 to 128 unreserved characters'),
    code: z.string().min(1),
    /** The one grant there is, RFC 6749 section 4.1.3. */
    grantType: z.string().refine(value => value === 'authorization_code', 'Only authorization_code is supported'),
    provider: loginProviderSchema,
    /** A bearer token of the provider's own, see tokens.ts. */
    accessToken: z.string().min(1),
    /** Where a logged out visitor asks to go, see RP-Initiated Logout section 2. */
    postLogoutRedirectUri: z.string().nullable(),
})

export const oidcSchemas = {
    params: {
        issueCode: paramsFieldSchemas.pick({
            userId: true,
            clientId: true,
            redirectUri: true,
            responseType: true,
            scope: true,
            state: true,
            nonce: true,
            codeChallenge: true,
            codeChallengeMethod: true,
            provider: true,
        }),
        exchangeCode: paramsFieldSchemas.pick({
            clientId: true,
            redirectUri: true,
            code: true,
            codeVerifier: true,
        }),
        userinfo: paramsFieldSchemas.pick({
            accessToken: true,
        }),
        endSession: paramsFieldSchemas.pick({
            postLogoutRedirectUri: true,
        }),
    },
    data: {
        token: paramsFieldSchemas.pick({
            grantType: true,
            clientId: true,
            redirectUri: true,
            code: true,
            codeVerifier: true,
        }),
    },
}
