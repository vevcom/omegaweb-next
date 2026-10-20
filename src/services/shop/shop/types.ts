import type { LedgerAccount, Shop } from '@/prisma-generated-pn-types'
import type { ExtendedProduct } from '@/services/shop/product/types'
import type { ExpandedCmsImage } from '@/cms/images/types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

/** A product as the shop sells it, and whether other shops sell it too (see productAuth.update). */
export type ShopPageProduct = ExtendedProduct & {
    image: ExpandedCmsImage,
    soldElsewhere: boolean,
}

/**
 * A shop as read for its pages: with both visibility levels, so the client can decide which
 * controls to show without reading them separately.
 */
export type ExtendedShop = Shop & {
    products: ShopPageProduct[],
    ledgerAccount: Pick<LedgerAccount, 'id' | 'name'> | null,
    visibility: DoubleLevelVisibilityMatrix,
}
