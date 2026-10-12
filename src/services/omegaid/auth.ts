import { Require } from '@/auth/authorizer/Require'

export const omegaIdAuth = {
    generate: Require.userId(),
    readPublicKey: Require.nothing(),
} as const
