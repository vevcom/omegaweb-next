import { Require } from '@/auth/authorizer/Require'
import { shopAdminLevel } from '@/services/shop/shop/auth'

/**
 * The product catalogue across every shop belongs to SHOP_ADMIN. What one shop sells, and at
 * what price, is administered from that shop (see shopAuth).
 */
const catalogue = Require.permission('SHOP_ADMIN')

export const productAuth = {
    create: catalogue,
    read: catalogue,
    readMany: catalogue,

    // The kiosk looks products up by barcode with an API key holding PURCHASE_ADMIN, the
    // permission it charges cards with. An API key has no memberships to pass a shop's level.
    readByBarCode: Require.permission('PURCHASE_ADMIN'),

    // A product sold in one shop alone is that shop's to describe, so its admin level may
    // change the name, description and barcode. Sold in several shops, or in none, it is the
    // catalogue's. Needs `{ visibility }` via `.data()`: the admin level of the one shop selling
    // it, or EMPTY_VISIBILITY, which no one passes.
    update: shopAdminLevel,
} as const
