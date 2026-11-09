import { Require } from '@/auth/authorizer/Require'

export const oidcAuth = {
    /** The signed in user, and for themselves alone: a code says who they are. */
    issueCode: Require.userId({ errorMessage: 'Logg inn for å fortsette' }),
    /** No session takes part: the code, bound to the client and proved with the verifier, is the credential. */
    exchangeCode: Require.nothing(),
} as const
