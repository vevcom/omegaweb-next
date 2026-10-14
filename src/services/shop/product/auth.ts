import { Require } from '@/auth/authorizer/Require'
import { shopAdminLevel } from '@/services/shop/shop/auth'

const readProducts = Require.permission('PRODUCT_USE')

export const productAuth = {
    create: Require.permission('PRODUCT_ADMIN'),
    read: readProducts,
    readMany: readProducts,
    // The kiosk looks products up by barcode with an API key holding PRODUCT_USE.
    readByBarCode: readProducts,
    update: Require.permission('PRODUCT_ADMIN'),
    createForShop: shopAdminLevel,
    updateForShop: shopAdminLevel,
    createShopConnection: shopAdminLevel,
} as const
