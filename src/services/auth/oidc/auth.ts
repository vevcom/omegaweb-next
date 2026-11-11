import { Require } from '@/auth/authorizer/Require'

export const oidcAuth = {
    /** The signed in user, and for themselves alone: a code says who they are. */
    issueCode: Require.userId({ errorMessage: 'Logg inn for å fortsette' }),
    /** No session takes part: the code, bound to the client and proved with the verifier, is the credential. */
    exchangeCode: Require.nothing(),
    token: Require.nothing(),
    /** The access token is the credential. */
    userinfo: Require.nothing(),
    /** Logging out is for everyone, signed in or not. */
    endSession: Require.nothing(),
    /** The documents are public, as the protocol has them. */
    discovery: Require.nothing(),
    jwks: Require.nothing(),
} as const
