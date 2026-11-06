import type { ExpandedCmsImage } from '@/cms/images/types'
import type { Product, ShopProduct } from '@/prisma-generated-pn-types'


export type ExtendedProduct = Pick<ShopProduct, 'price' | 'active'> & Product & {
    image: ExpandedCmsImage,
}
