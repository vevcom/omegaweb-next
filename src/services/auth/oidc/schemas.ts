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
    /** The scopes asked for, space separated. Unknown ones are ignored, as section 3.1.2.1 says; `openid` must be there. */
    scope: z.string()
        .transform(scope => scope.split(' ').filter(isScope))
        .refine(scopes => scopes.includes('openid'), 'An OpenID Connect request asks for the openid scope'),
    nonce: z.string().min(1).nullable(),
    /** The S256 challenge, RFC 7636: the base64url sha256 of the verifier, which is 43 characters. */
    codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'The code challenge is the base64url sha256 of the verifier'),
    codeChallengeMethod: z.literal('S256'),
    codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/, 'A code verifier is 43 to 128 unreserved characters'),
    code: z.string().min(1),
    provider: loginProviderSchema,
})

export const oidcSchemas = {
    params: {
        issueCode: paramsFieldSchemas.pick({
            userId: true,
            clientId: true,
            redirectUri: true,
            scope: true,
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
    },
}
