import { EditProductForShopForm } from './EditProductForShopForm'
import styles from './page.module.scss'
import FindProductForm from './FindProductForm'
import ConnectShopToLedgerForm from './ConnectShopToLedgerForm'
import ShopVisibilityAdmin from './ShopVisibilityAdmin'
import UpdateShopForm from './UpdateShopForm'
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
        const shop = await shopOperations.read({ params: { shopId: parseInt(params.shop, 10) } })
        authorizeShopAdminPage(shop.visibility).auth(session).requireAuthorized()

        const [allProducts, ledgerAccounts] = await Promise.all([
            productOperations.readMany({}),
            ledgerAccountOperations.readAccessible({ params: { includeGroupAccounts: true, includeUserAccounts: false } }),
        ])

        const soldProductIds = new Set(shop.products.map(product => product.id))
        const unconnectedProducts = allProducts.filter(product => !soldProductIds.has(product.id))

        return { shop, unconnectedProducts, ledgerAccounts }
    },
    capabilities: (data) => ({
        canUpdateShop: shopAuth.update.data({ visibility: data.shop.visibility }),
        canCreateProduct: productAuth.createForShop.data({ visibility: data.shop.visibility }),
        canAddProduct: productAuth.createShopConnection.data({ visibility: data.shop.visibility }),
        canUpdateProduct: productAuth.updateForShop.data({ visibility: data.shop.visibility }),
        canConnectToLedger: shopAuth.connectToLedger.data({
            visibility: data.shop.visibility,
            accounts: data.ledgerAccounts.map(account => account.ownership),
        }),
    }),
    metadata: (data) => ({ title: data.shop.name }),
    render: ({ data: { shop, unconnectedProducts, ledgerAccounts }, capabilities }) => (
        <PageWrapper>
            <p>{shop.description}</p>
            {capabilities.canUpdateShop.authorized && (
                <PopUp
                    showButtonClass={styles.button}
                    showButtonContent="Rediger butikk"
                    popUpKey="updateShop"
                >
                    <UpdateShopForm shop={shop} />
                </PopUp>
            )}
            <p>
                Konto: {shop.ledgerAccount
                    ? (shop.ledgerAccount.name ?? `Konto ${shop.ledgerAccount.id}`)
                    : 'ingen. Kjøp feiler til butikken er knyttet til en konto.'}
            </p>
            {capabilities.canConnectToLedger.authorized && (
                <PopUp
                    showButtonClass={styles.button}
                    showButtonContent="Knytt til konto"
                    popUpKey="connectShopToLedger"
                >
                    <ConnectShopToLedgerForm
                        shopId={shop.id}
                        currentLedgerAccountId={shop.ledgerAccountId}
                        ledgerAccounts={ledgerAccounts}
                    />
                </PopUp>
            )}
            <ShopVisibilityAdmin shop={shop} />

            {(capabilities.canAddProduct.authorized || capabilities.canCreateProduct.authorized) && (
                <PopUp
                    showButtonClass={styles.button}
                    showButtonContent="Legg til Produkt"
                    popUpKey="createProductForShop"
                >
                    {capabilities.canAddProduct.authorized && (
                        <FindProductForm shopId={shop.id} products={unconnectedProducts} />
                    )}
                    <br />
                    {capabilities.canCreateProduct.authorized && <EditProductForShopForm shopId={shop.id} />}
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
                    {sortObjectsByName(shop.products).map(product => <tr
                        key={product.id}
                        className={product.active ? '' : styles.deactivatedProduct}
                    >
                        {capabilities.canUpdateProduct.authorized && (
                            <td className={styles.editButtonWrapper}>
                                <PopUp
                                    showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                                    popUpKey={`EditProductForShop-${product.id}`}
                                >
                                    <EditProductForShopForm shopId={shop.id} product={product} />
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
    ),
})

export default page
export { generateMetadata }
