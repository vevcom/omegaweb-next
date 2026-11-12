import { Require } from '@/auth/authorizer/Require'

export const authAuth = {
    // A valid JWT is the entire admission control of the two link operations, not the session. It
    // is verified directly in the operation body in operations.ts.
    sendLinkFeideAccountEmail: Require.userId(),
    readFeideLoginMatch: Require.userId(),
    verifyLinkFeideAccountToken: Require.nothing(),
    linkFeideAccount: Require.nothing(),
    adminLinkFeideAccount: Require.permission('USERS_ADMIN'),
} as const
