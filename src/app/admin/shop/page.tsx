import ShopForm from './shopForm'
import styles from './page.module.scss'
import { AddHeaderItemPopUp } from '@/app/_components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { sortObjectsByName } from '@/lib/sortObjects'
import { shopOperations } from '@/services/shop/shop/operations'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('shop', session)
        return shopOperations.readMany({})
    },
    metadata: () => ({ title: 'Butikker' }),
    render: ({ data: shops }) => (
        <PageWrapper
            headerItem={
                <AddHeaderItemPopUp popUpKey="createShopForm">
                    <ShopForm />
                </AddHeaderItemPopUp>
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
                                <Link style={{ display: 'contents' }} href={`./shop/${shop.id}`} passHref>
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
