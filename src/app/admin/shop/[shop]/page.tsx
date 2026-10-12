import { EditProductForShopForm } from './EditProductForShopForm'
import styles from './page.module.scss'
import FindProductForm from './FindProductForm'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import PopUp from '@/app/_components/PopUp/PopUp'
import { displayAmount } from '@/lib/currency/convert'
import { sortObjectsByName } from '@/lib/sortObjects'
import { shopOperations } from '@/services/shop/shop/operations'
import { productOperations } from '@/services/shop/product/operations'
import { serverPage } from '@/app/serverPage'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shop: string }>) => {
        const shopId = parseInt(params.shop, 10)
        if (isNaN(shopId)) notFound()

        const [shopData, allProducts] = await Promise.all([
            shopOperations.read({ params: { shopId } }),
            productOperations.readMany({}),
        ])
        if (!shopData) notFound()

        const existingProductIds = new Set(shopData.products.map(product => product.id))
        const unconnectedProducts = allProducts.filter(product => !existingProductIds.has(product.id))

        return { shopId, shopData, unconnectedProducts }
    },
    metadata: (data) => ({ title: data.shopData.name }),
    render: ({ data }) => {
        const { shopId, shopData, unconnectedProducts } = data

        return (
            <PageWrapper>
                <p>{shopData.description}</p>

                <PopUp
                    showButtonClass={styles.button}
                    showButtonContent="Legg til Produkt"
                    popUpKey="createProductForShop"
                >
                    <FindProductForm shopId={shopId} products={unconnectedProducts} />
                    <br />
                    <EditProductForShopForm shopId={shopId} />
                </PopUp>

                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Rediger</th>
                            <th>Produkt</th>
                            <th>Beskrivelse</th>
                            <th>Pris</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortObjectsByName(shopData.products).map(product => <tr
                            key={product.id}
                            className={product.active ? '' : styles.deactivatedProduct}
                        >
                            <td className={styles.editButtonWrapper}>
                                <PopUp
                                    showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                                    popUpKey={'EditProductForShop'}
                                >
                                    <EditProductForShopForm shopId={shopId} product={product} />
                                </PopUp>
                            </td>
                            <td>{product.name}</td>
                            <td>{product.description}</td>
                            <td>{displayAmount(product.price, false)}</td>
                        </tr>)}
                    </tbody>
                </table>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
