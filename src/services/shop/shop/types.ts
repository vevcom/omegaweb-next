import type { LedgerAccount, Shop } from '@/prisma-generated-pn-types'
import type { ExtendedProduct } from '@/services/shop/product/types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'


/**
 * A shop as read for its pages: with both visibility levels, so the client can decide which
 * controls to show without reading them separately.
 */
export type ExtendedShop = Shop & {
    products: ExtendedProduct[],
    ledgerAccount: Pick<LedgerAccount, 'id' | 'name'> | null,
    visibility: DoubleLevelVisibilityMatrix,
}
