import styles from './page.module.scss'
import ShopUI from './ShopUI'
import UpdateShopForm from './UpdateShopForm'
import ConnectShopToLedgerForm from './ConnectShopToLedgerForm'
import ShopVisibilityAdmin from './ShopVisibilityAdmin'
import FindProductForm from './FindProductForm'
import { EditProductForShopForm } from './EditProductForShopForm'
import { administersShop } from './administersShop'
import { AddHeaderItemPopUp, SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { serverPage, withFallback } from '@/app/serverPage'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { Require } from '@/auth/authorizer/Require'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { productOperations } from '@/services/shop/product/operations'
import { productAuth } from '@/services/shop/product/auth'
import { purchaseAuth } from '@/services/shop/purchase/auth'
import { shopOperations } from '@/services/shop/shop/operations'
import { shopAuth } from '@/services/shop/shop/auth'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ shop: string }>) => {
        const shop = await shopOperations.read({ params: { shopId: parseInt(params.shop, 10) } })

        // The catalogue and the accounts feed the controls of those who administer the shop, so
        // they are loaded for no one else. Each falls back to empty rather than taking the page
        // down: an administrator without PRODUCT_USE can still create products from here.
        const administers = administersShop(shop.visibility).auth(session).authorized
        const [allProducts, ledgerAccounts] = administers
            ? await Promise.all([
                withFallback(productOperations.readMany({}), []),
                withFallback(ledgerAccountOperations.readAccessible({
                    params: { includeGroupAccounts: true, includeUserAccounts: false },
                }), []),
            ])
            : [[], []]
        const soldProductIds = new Set(shop.products.map(product => product.id))

        return {
            shop,
            userId: session.user?.id ?? null,
            unconnectedProducts: allProducts.filter(product => !soldProductIds.has(product.id)),
            ledgerAccounts,
        }
    },
    capabilities: (data, session) => ({
        canPurchase: session.user
            ? purchaseAuth.create.data({ userId: session.user.id, visibility: data.shop.visibility })
            : Require.user(),
        canUpdateShop: shopAuth.update.data({ visibility: data.shop.visibility }),
        canUpdateRegularLevel: shopAuth.updateRegularLevel.data({ visibility: data.shop.visibility }),
        canUpdateAdminLevel: shopAuth.updateAdminLevel.data({ visibility: data.shop.visibility }),
        canConnectToLedger: shopAuth.connectToLedger.data({
            visibility: data.shop.visibility,
            accounts: data.ledgerAccounts.map(account => account.ownership),
        }),
        canCreateProduct: productAuth.createForShop.data({ visibility: data.shop.visibility }),
        canAddProduct: productAuth.createShopConnection.data({ visibility: data.shop.visibility }),
        canUpdateProduct: productAuth.updateForShop.data({ visibility: data.shop.visibility }),
    }),
    metadata: (data) => ({ title: data.shop.name }),
    render: ({ data: { shop, userId, unconnectedProducts, ledgerAccounts }, capabilities }) => (
        <PageWrapper
            headerItem={
                <div className={styles.head}>
                    {(capabilities.canAddProduct.authorized || capabilities.canCreateProduct.authorized) && (
                        <AddHeaderItemPopUp popUpKey="addProductToShop" label="Produkt">
                            {capabilities.canAddProduct.authorized && (
                                <FindProductForm shopId={shop.id} products={unconnectedProducts} />
                            )}
                            {capabilities.canCreateProduct.authorized && (
                                <EditProductForShopForm shopId={shop.id} closePopUpOnSuccess="addProductToShop" />
                            )}
                        </AddHeaderItemPopUp>
                    )}
                    {(
                        capabilities.canUpdateShop.authorized ||
                        capabilities.canConnectToLedger.authorized ||
                        capabilities.canUpdateRegularLevel.authorized ||
                        capabilities.canUpdateAdminLevel.authorized
                    ) && (
                        <SettingsHeaderItemPopUp scale={30} popUpKey="shopSettings">
                            {capabilities.canUpdateShop.authorized && <UpdateShopForm shop={shop} />}
                            {capabilities.canConnectToLedger.authorized && <>
                                <p>
                                    Konto: {shop.ledgerAccount
                                        ? (shop.ledgerAccount.name ?? `Konto ${shop.ledgerAccount.id}`)
                                        : 'ingen. Kjøp feiler til butikken er knyttet til en konto.'}
                                </p>
                                <ConnectShopToLedgerForm
                                    shopId={shop.id}
                                    currentLedgerAccountId={shop.ledgerAccountId}
                                    ledgerAccounts={ledgerAccounts}
                                />
                            </>}
                            <ShopVisibilityAdmin shop={shop} />
                        </SettingsHeaderItemPopUp>
                    )}
                </div>
            }
        >
            <p>{shop.description}</p>
            <ShopUI
                shop={shop}
                userId={userId}
                capabilities={capabilitiesToJsObject({
                    canPurchase: capabilities.canPurchase,
                    canUpdateProduct: capabilities.canUpdateProduct,
                })}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
