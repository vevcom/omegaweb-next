import { EditProductForShopForm } from './EditProductForShopForm'
import styles from './page.module.scss'
import FindProductForm from './FindProductForm'
import ConnectShopToLedgerForm from './ConnectShopToLedgerForm'
import ShopVisibilityAdmin from './ShopVisibilityAdmin'
import { authorizeShopAdminPage } from './authorizeShopAdminPage'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import PopUp from '@/app/_components/PopUp/PopUp'
import { displayAmount } from '@/lib/currency/convert'
import { sortObjectsByName } from '@/lib/sortObjects'
import { shopOperations } from '@/services/shop/shop/operations'
import { shopAuth } from '@/services/shop/shop/auth'
import { productAuth } from '@/services/shop/product/auth'
import { productOperations } from '@/services/shop/product/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { serverPage } from '@/app/serverPage'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ shop: string }>) => {
        const shopId = parseInt(params.shop, 10)
        const shopData = await shopOperations.read({ params: { shopId } })
        authorizeShopAdminPage(shopData.visibility).auth(session).requireAuthorized()

        const [allProducts, ledgerAccounts] = await Promise.all([
            productOperations.readMany({}),
            ledgerAccountOperations.readAccessible({ params: { includeGroupAccounts: true, includeUserAccounts: false } }),
        ])

        const existingProductIds = new Set(shopData.products.map(product => product.id))
        const unconnectedProducts = allProducts.filter(product => !existingProductIds.has(product.id))

        return { shopId, shopData, unconnectedProducts, ledgerAccounts }
    },
    capabilities: (data) => ({
        canCreateProduct: productAuth.createForShop.data({ visibility: data.shopData.visibility }),
        canAddProduct: productAuth.createShopConnection.data({ visibility: data.shopData.visibility }),
        canUpdateProduct: productAuth.updateForShop.data({ visibility: data.shopData.visibility }),
        canConnectToLedger: shopAuth.connectToLedger.data({
            visibility: data.shopData.visibility,
            accounts: data.ledgerAccounts.map(account => account.ownership),
        }),
    }),
    metadata: (data) => ({ title: data.shopData.name }),
    render: ({ data, capabilities }) => {
        const { shopId, shopData, unconnectedProducts, ledgerAccounts } = data

        return (
            <PageWrapper>
                <p>{shopData.description}</p>
                <p>
                    Konto: {shopData.ledgerAccount
                        ? (shopData.ledgerAccount.name ?? `Konto ${shopData.ledgerAccount.id}`)
                        : 'ingen. Kjøp feiler til butikken er knyttet til en konto.'}
                </p>
                {capabilities.canConnectToLedger.authorized && (
                    <PopUp
                        showButtonClass={styles.button}
                        showButtonContent="Knytt til konto"
                        popUpKey="connectShopToLedger"
                    >
                        <ConnectShopToLedgerForm
                            shopId={shopId}
                            currentLedgerAccountId={shopData.ledgerAccountId}
                            ledgerAccounts={ledgerAccounts}
                        />
                    </PopUp>
                )}
                <ShopVisibilityAdmin shop={shopData} />

                {(capabilities.canAddProduct.authorized || capabilities.canCreateProduct.authorized) && (
                    <PopUp
                        showButtonClass={styles.button}
                        showButtonContent="Legg til Produkt"
                        popUpKey="createProductForShop"
                    >
                        {capabilities.canAddProduct.authorized && (
                            <FindProductForm shopId={shopId} products={unconnectedProducts} />
                        )}
                        <br />
                        {capabilities.canCreateProduct.authorized && <EditProductForShopForm shopId={shopId} />}
                    </PopUp>
                )}

                <table className={styles.table}>
                    <thead>
                        <tr>
                            {capabilities.canUpdateProduct.authorized && <th>Rediger</th>}
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
                            {capabilities.canUpdateProduct.authorized && (
                                <td className={styles.editButtonWrapper}>
                                    <PopUp
                                        showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                                        popUpKey={`EditProductForShop-${product.id}`}
                                    >
                                        <EditProductForShopForm shopId={shopId} product={product} />
                                    </PopUp>
                                </td>
                            )}
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
