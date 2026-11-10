import { oidcProtocol } from './constants'
import { isOidcScope } from './scopes'
import { oidcWireNames } from './wire'
import { z } from 'zod'

/** The login a session on the auth domain came from, as the NextAuth token names it. */
export const loginProviderSchema = z.enum(['credentials', 'feide'])

/**
 * A parameter as it comes off the wire, see wire.ts: null when it is not there, which is refused
 * by the parameter's wire name, as is an empty one.
 */
const parameter = (wireName: string) => z.string().nullable().transform((value, context) => {
    if (value === null || value === '') {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${wireName} is required` })
        return z.NEVER
    }
    return value
})

/** A parameter the protocol allows one value of, see oidcProtocol. */
const oneOf = (wireName: string, allowed: string, message: string) =>
    parameter(wireName).refine(value => value === allowed, message)

/** The parameters of the protocol, as the client sends them, see RFC 6749 and OpenID Connect Core. */
const paramsFieldSchemas = z.object({
    /** The user the code is for, who is the one signed in. */
    userId: z.number().int(),
    clientId: parameter(oidcWireNames.clientId),
    redirectUri: parameter(oidcWireNames.redirectUri).pipe(z.string().url()),
    responseType: oneOf(
        oidcWireNames.responseType,
        oidcProtocol.responseType,
        'Only the authorization code flow is supported',
    ),
    /** The scopes asked for, space separated. Unknown ones are ignored, as section 3.1.2.1 says; `openid` must be there. */
    scope: parameter(oidcWireNames.scope)
        .transform(scope => scope.split(' ').filter(isOidcScope))
        .refine(scopes => scopes.includes('openid'), 'An OpenID Connect request asks for the openid scope'),
    /** The client's own value, which it gets back with the code and ties the answer to its request by. */
    state: parameter(oidcWireNames.state),
    nonce: z.string().min(1).nullable(),
    /** The S256 challenge, RFC 7636: the base64url sha256 of the verifier, which is 43 characters. */
    codeChallenge: parameter(oidcWireNames.codeChallenge)
        .pipe(z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'The code challenge is the base64url sha256 of the verifier')),
    codeChallengeMethod: oneOf(
        oidcWireNames.codeChallengeMethod,
        oidcProtocol.codeChallengeMethod,
        `${oidcWireNames.codeChallengeMethod} must be ${oidcProtocol.codeChallengeMethod}`,
    ),
    codeVerifier: parameter(oidcWireNames.codeVerifier)
        .pipe(z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/, 'A code verifier is 43 to 128 unreserved characters')),
    code: parameter(oidcWireNames.code),
    grantType: oneOf(oidcWireNames.grantType, oidcProtocol.grantType, `Only ${oidcProtocol.grantType} is supported`),
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
