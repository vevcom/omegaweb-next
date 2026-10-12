import { Require } from '@/auth/authorizer/Require'

export const omegaQuotesAuth = {
    create: Require.userId().permission('OMEGAQUOTES_USE'),
    readPage: Require.permission('OMEGAQUOTES_USE')
} as const
