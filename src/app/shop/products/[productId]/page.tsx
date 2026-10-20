import ProductForm from '@/app/shop/products/ProductForm'
import CmsImage from '@/cms/CmsImage/CmsImage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { displayAmount } from '@/lib/currency/convert'
import { productOperations } from '@/services/shop/product/operations'
import { productAuth } from '@/services/shop/product/auth'
import { updateProductCmsImageAction } from '@/services/shop/product/actions'
import { configureAction } from '@/services/configureAction'
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
        canEditImage: productAuth.updateCmsImage.data({ visibility: EMPTY_VISIBILITY }),
    }),
    metadata: (product) => ({ title: product.name }),
    render: ({ data: product, capabilities }) => (
        <PageWrapper>
            <div className="mb-6 flex flex-wrap items-start gap-6">
                <div className="w-full max-w-[320px] aspect-square overflow-hidden rounded-round bg-surface-hover shadow-soft">
                    <CmsImage
                        cmsImage={product.image}
                        updateCmsImageAction={configureAction(
                            updateProductCmsImageAction,
                            { implementationParams: { productId: product.id } },
                        )}
                        capabilities={{ canEdit: capabilities.canEditImage }}
                        width={400}
                        alt={product.name}
                        className="block! size-full [&_div]:size-full [&_img]:size-full [&_img]:object-cover"
                    />
                </div>
                <div className="min-w-[260px] flex-1">
                    {product.description && <p className="mt-0 text-m text-text-muted">{product.description}</p>}
                    {capabilities.canUpdateProduct.authorized && <ProductForm product={product} />}
                </div>
            </div>

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
