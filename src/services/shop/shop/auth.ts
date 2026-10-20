import { Require } from '@/auth/authorizer/Require'
import { ledgerAccountAccess } from '@/services/ledger/accounts/ownership'

/**
 * A shop's regular level decides who may see it and buy in it, its admin level who may change its
 * products, its visibility and the account it pays into. SHOP_ADMIN bypasses both levels for
 * every shop, and is the only way to create one. Both levels still need
 * `{ visibility: DoubleLevelVisibilityMatrix }` supplied via `.data()`.
 *
 * The admin level is exported for the product service: a product sold in one shop alone is that
 * shop's to describe.
 */
const shopRegularLevel = Require.permission('SHOP_ADMIN').or().levelOfDoubleVisibility({ level: 'regularLevel' })
export const shopAdminLevel = Require.permission('SHOP_ADMIN').or().levelOfDoubleVisibility({ level: 'adminLevel' })

export const shopAuth = {
    create: Require.permission('SHOP_ADMIN'),

    readMany: Require.visibilityFilter({ bypassPermission: 'SHOP_ADMIN' }),
    read: shopRegularLevel,

    readDoubleLevelMatrix: shopRegularLevel,
    updateRegularLevel: shopAdminLevel,
    updateAdminLevel: shopAdminLevel,
    update: shopAdminLevel,

    // What the shop sells, and at what price, is part of administering it. Creating a product
    // from a shop puts a new product in the catalogue, which harms no other shop; changing a
    // product that other shops sell is the catalogue's business (see productAuth.update).
    createProduct: shopAdminLevel,
    connectProduct: shopAdminLevel,
    updateProduct: shopAdminLevel,
    readProductsToConnect: shopAdminLevel,

    // A shop's purchases are credited to the account it is linked to, so linking takes access to
    // that account on top of administering the shop. Needs `{ accounts }` via `.data()` as well.
    connectToLedgerAccount: Require.allOf(shopAdminLevel, ledgerAccountAccess('LEDGER_ADMIN')),
} as const
