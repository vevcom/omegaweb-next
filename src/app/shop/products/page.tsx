import ProductForm from './ProductForm'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { sortObjectsByName } from '@/lib/sortObjects'
import { displayAmount } from '@/lib/currency/convert'
import { productOperations } from '@/services/shop/product/operations'
import { productAuth } from '@/services/shop/product/auth'
import { serverPage } from '@/app/ServerPage'
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
                        <th>Produkt</th>
                        <th>Beskrivelse</th>
                        <th>Strekkode</th>
                        <th>Foreslått pris</th>
                    </tr>
                </thead>
                <tbody>
                    {sortObjectsByName(products).map(product => <tr key={product.id}>
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
