import { Require } from '@/auth/authorizer/Require'

export const authAuth = {
    // A valid JWT is the entire admission control here, not the session. It's verified directly in
    // the operation body in operations.ts.
    verifyEmail: Require.nothing(),
    verifyResetPasswordToken: Require.nothing(),
    resetPassword: Require.nothing(),
    sendResetPasswordEmail: Require.nothing(),
    sendLinkFeideAccountEmail: Require.userId(),
    readFeideLoginMatch: Require.userId(),
    verifyLinkFeideAccountToken: Require.nothing(),
    linkFeideAccount: Require.nothing(),
    adminLinkFeideAccount: Require.permission('USERS_ADMIN'),
} as const
