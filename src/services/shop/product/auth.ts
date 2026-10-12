import { Require } from '@/auth/authorizer/Require'
import { shopAdminLevel } from '@/services/shop/shop/auth'

export const productAuth = {
    read: Require.permission('PRODUCT_USE'),
    create: Require.permission('PRODUCT_ADMIN'),
    update: Require.permission('PRODUCT_ADMIN'),
    // What is done to a shop's products is part of administering that shop. Needs
    // `{ visibility }` via `.data()`.
    createForShop: shopAdminLevel,
    updateForShop: shopAdminLevel,
    createShopConnection: shopAdminLevel,
} as const
