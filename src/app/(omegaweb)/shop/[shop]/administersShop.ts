import { Require } from '@/auth/authorizer/Require'
import { shopAuth } from '@/services/shop/shop/auth'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/**
 * Whether the viewer administers the shop in any way: passing the authorizer of any one of its
 * administering operations is enough. The shop page uses it to decide whether to load what the
 * admin controls need (the products to connect, the accounts); which controls to show is then
 * each operation's own rule. Not SHOP_ADMIN alone, since a group handed a shop's admin level
 * administers it from here.
 */
export const administersShop = (visibility: DoubleLevelVisibilityMatrix) => Require.anyOf(
    shopAuth.createProduct,
    shopAuth.connectProduct,
    shopAuth.updateProduct,
    shopAuth.update,
    shopAuth.updateRegularLevel,
    shopAuth.updateAdminLevel,
).data({ visibility })
