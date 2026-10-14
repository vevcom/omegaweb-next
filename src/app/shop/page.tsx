import styles from './page.module.scss'
import CreateShopForm from './CreateShopForm'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import HeaderItemLink from '@/components/HeaderItems/HeaderItemLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { sortObjectsByName } from '@/lib/sortObjects'
import { shopOperations } from '@/services/shop/shop/operations'
import { shopAuth } from '@/services/shop/shop/auth'
import { productAuth } from '@/services/shop/product/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/serverPage'
import { faBox } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'

const { page, generateMetadata } = serverPage({
    operation: () => shopOperations.readMany({}),
    capabilities: () => ({
        canCreateShop: shopAuth.create,
        // The product catalogue is for those who administer products across shops.
        canAdministerProducts: Require.anyOf(productAuth.create, productAuth.update),
    }),
    metadata: () => ({ title: 'Butikker' }),
    render: ({ data: shops, capabilities }) => (
        <PageWrapper
            headerItem={
                <div className={styles.head}>
                    {capabilities.canAdministerProducts.authorized && (
                        <HeaderItemLink href="/shop/products" label="Produkter" icon={faBox} />
                    )}
                    {capabilities.canCreateShop.authorized && (
                        <AddHeaderItemPopUp popUpKey="createShop">
                            <CreateShopForm />
                        </AddHeaderItemPopUp>
                    )}
                </div>
            }
        >
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Butikk</th>
                        <th>Beskrivelse</th>
                    </tr>
                </thead>
                <tbody>
                    {sortObjectsByName(shops).map(shop =>
                        <tr key={shop.id}>
                            <td>
                                <Link style={{ display: 'contents' }} href={`/shop/${shop.id}`} passHref>
                                    {shop.name}
                                </Link>
                            </td>
                            <td>{shop.description}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
