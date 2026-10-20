import ProductForm from './ProductForm'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { sortObjectsByName } from '@/lib/sortObjects'
import { displayAmount } from '@/lib/currency/convert'
import { productOperations } from '@/services/shop/product/operations'
import { productAuth } from '@/services/shop/product/auth'
import { serverPage } from '@/app/ServerPage'
import Image from '@/components/Image/Image'
import StandardImageServer from '@/components/Image/StandardImageServer'
import Link from 'next/link'

/** The product catalogue across every shop. Which shops sell a product is on its own page. */
const { page, generateMetadata } = serverPage({
    operation: () => productOperations.readMany({}),
    capabilities: () => ({
        canCreateProduct: productAuth.create,
    }),
    metadata: () => ({ title: 'Produkter' }),
    render: ({ data: products, capabilities }) => (
        <PageWrapper
            headerItem={capabilities.canCreateProduct.authorized &&
                <AddHeaderItemPopUp popUpKey="createProduct">
                    <ProductForm />
                </AddHeaderItemPopUp>
            }
        >
            <table className="ohma-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Produkt</th>
                        <th>Beskrivelse</th>
                        <th>Strekkode</th>
                        <th>Foreslått pris</th>
                    </tr>
                </thead>
                <tbody>
                    {sortObjectsByName(products).map(product => <tr key={product.id}>
                        <td className="w-14">
                            <div className="size-12 overflow-hidden rounded-inner bg-surface-hover [&_div]:size-full [&_img]:size-full [&_img]:object-cover">
                                {product.image.image
                                    ? <Image image={product.image.image} width={60} alt={product.name} hideCredit />
                                    : <StandardImageServer standardImage="DEFAULT_IMAGE" width={60} />}
                            </div>
                        </td>
                        <td>
                            <Link
                                style={{ display: 'contents' }}
                                aria-label={`Gå til produktsiden for ${product.name}`}
                                href={`/shop/products/${product.id}`}
                                passHref
                            >
                                {product.name}
                            </Link>
                        </td>
                        <td>{product.description}</td>
                        <td>{product.barcode ?? ''}</td>
                        <td>{product.suggestedPrice === null ? '' : displayAmount(product.suggestedPrice, false)}</td>
                    </tr>)}
                </tbody>
            </table>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
