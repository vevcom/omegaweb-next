import { Require } from '@/auth/authorizer/Require'
import { productAuth } from '@/services/shop/product/auth'
import { shopAuth } from '@/services/shop/shop/auth'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/**
 * The admin page of a shop opens for anyone who may do something on it, on the same terms as
 * `authorizeAdminPage` opens the nav's pages: passing the authorizer of any one of its operations
 * is enough. Not the nav's SHOP_ADMIN alone, since a group handed a shop's admin level
 * administers it from here. Links to the page are gated on the same rule.
 */
export const authorizeShopAdminPage = (visibility: DoubleLevelVisibilityMatrix) => Require.anyOf(
    productAuth.createForShop,
    productAuth.createShopConnection,
    productAuth.updateForShop,
    shopAuth.update,
    shopAuth.updateRegularLevel,
    shopAuth.updateAdminLevel,
).data({ visibility })
