import { Require } from '@/auth/authorizer/Require'

export const shopAuth = {
    read: Require.permission('SHOP_USE'),
    create: Require.permission('SHOP_ADMIN'),
} as const
