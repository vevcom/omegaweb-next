import { Require } from '@/auth/authorizer/Require'

export const productAuth = {
    read: Require.permission('PRODUCT_USE'),
    create: Require.permission('PRODUCT_ADMIN'),
    update: Require.permission('PRODUCT_ADMIN'),
    createShopConnection: Require.permission('SHOP_ADMIN'),
} as const
