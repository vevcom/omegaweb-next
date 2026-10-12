import styles from './page.module.scss'
import ProductForm from '@/app/admin/product/productForm'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { displayAmount } from '@/lib/currency/convert'
import { productOperations } from '@/services/shop/product/operations'
import { serverPage } from '@/app/serverPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ productId: string }>) =>
        productOperations.read({ params: { productId: Number(params.productId) } }),
    metadata: (product) => ({ title: product.name }),
    render: ({ data: product }) => (
        <PageWrapper>
            <ProductForm product={product} />

            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Navn</th>
                        <th>Aktiv</th>
                        <th>Pris</th>
                    </tr>
                </thead>
                <tbody>
                    {product.ShopProduct.map(shopProduct => <tr key={shopProduct.shopId}>
                        <td><Link href={`/admin/shop/${shopProduct.shopId}`}>{shopProduct.shop.name}</Link></td>
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
