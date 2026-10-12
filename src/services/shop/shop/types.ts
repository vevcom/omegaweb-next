import type { LedgerAccount, Shop } from '@/prisma-generated-pn-types'
import type { ExtendedProduct } from '@/services/shop/product/types'


export type ExtendedShop = Shop & {
    products: ExtendedProduct[],
    ledgerAccount: Pick<LedgerAccount, 'id' | 'name'> | null,
}
