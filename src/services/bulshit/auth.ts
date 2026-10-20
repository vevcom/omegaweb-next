import { Require } from '@/auth/authorizer/Require'

export const bulshitAuth = {
    create: Require.userId().permission('BULSHIT_WRITE'),
    createOwn: Require.user().permission('BULSHIT_WRITE'),
    readPage: Require.permission('BULSHIT_USE'),
} as const
