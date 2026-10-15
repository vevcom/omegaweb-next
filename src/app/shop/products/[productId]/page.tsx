import ProductForm from '@/app/shop/products/ProductForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { displayAmount } from '@/lib/currency/convert'
import { productOperations } from '@/services/shop/product/operations'
import { productAuth } from '@/services/shop/product/auth'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { serverPage } from '@/app/ServerPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/ServerPage'

/** One product of the catalogue: what it is, and the shops that sell it. */
const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ productId: string }>) =>
        productOperations.read({ params: { productId: Number(params.productId) } }),
    capabilities: () => ({
        // The catalogue is SHOP_ADMIN's, which bypasses the shop level the rule otherwise takes.
        canUpdateProduct: productAuth.update.data({ visibility: EMPTY_VISIBILITY }),
    }),
    metadata: (product) => ({ title: product.name }),
    render: ({ data: product, capabilities }) => (
        <PageWrapper>
            {capabilities.canUpdateProduct.authorized && <ProductForm product={product} />}

            <table className="ohma-table">
                <thead>
                    <tr>
                        <th>Butikk</th>
                        <th>Aktiv</th>
                        <th>Pris</th>
                    </tr>
                </thead>
                <tbody>
                    {product.ShopProduct.map(shopProduct => <tr key={shopProduct.shopId}>
                        <td><Link href={`/shop/${shopProduct.shopId}`}>{shopProduct.shop.name}</Link></td>
                        <td>{shopProduct.active ? 'AKTIV' : 'INAKTIV'}</td>
                        <td>{displayAmount(shopProduct.price, false)}</td>
                    </tr>)}
                </tbody>
            </table>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
