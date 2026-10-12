import ProductForm from './productForm'
import styles from './page.module.scss'
import { AddHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { sortObjectsByName } from '@/lib/sortObjects'
import { productOperations } from '@/services/shop/product/operations'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('product', session)
        return productOperations.readMany({})
    },
    metadata: () => ({ title: 'Produkter' }),
    render: ({ data: products }) => (
        <PageWrapper
            headerItem={
                <AddHeaderItemPopUp popUpKey="ProductForm">
                    <ProductForm />
                </AddHeaderItemPopUp>
            }
        >
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Produkt</th>
                        <th>Beskrivelse</th>
                        <th>Strekkode</th>
                    </tr>
                </thead>
                <tbody>
                    {sortObjectsByName(products).map(product => <tr key={product.id}>
                        <td>
                            <Link
                                style={{ display: 'contents' }}
                                aria-label={`Gå til produktsiden for ${product.name}`}
                                href={`./product/${product.id}`}
                                passHref
                            >
                                {product.name}
                            </Link>
                        </td>
                        <td>{product.description}</td>
                        <td>{product.barcode ?? ''}</td>
                    </tr>)}
                </tbody>
            </table>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
