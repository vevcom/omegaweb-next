import { Require } from '@/auth/authorizer/Require'

export const bullshitAuth = {
    create: Require.userId().permission('BULLSHIT_WRITE'),
    createOwn: Require.user().permission('BULLSHIT_WRITE'),
    readPage: Require.permission('BULLSHIT_USE'),
} as const
