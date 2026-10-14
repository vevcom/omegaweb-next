import styles from './page.module.scss'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { sortObjectsByName } from '@/lib/sortObjects'
import { shopOperations } from '@/services/shop/shop/operations'
import { serverPage } from '@/app/serverPage'
import Link from 'next/link'

const { page, generateMetadata } = serverPage({
    operation: () => shopOperations.readMany({}),
    metadata: () => ({ title: 'Butikker' }),
    render: ({ data: shops }) => (
        <PageWrapper>
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
