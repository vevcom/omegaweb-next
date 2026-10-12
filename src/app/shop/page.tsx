'use server'
import styles from './page.module.scss'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { sortObjectsByName } from '@/lib/sortObjects'
import Link from 'next/link'
import { v4 as uuid } from 'uuid'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'
import { shopOperations } from '@/services/shop/shop/operations'
import { notFound } from 'next/navigation'


const { page, generateMetadata } = serverPage({
    operation: async ({ }: PageOperationArgs) => {
        const shops = await shopOperations.readMany({})
        if (!shops) {
            return notFound()
        }
        console.log(shops)


        return { shops }
    },
    metadata: () => ({ title: 'Butikker' }),
    render: ({ data }) =>
        <PageWrapper>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Butikk</th>
                        <th>Beskrivelse</th>
                    </tr>
                </thead>
                <tbody>
                    {sortObjectsByName(data.shops).map(shop =>
                        <tr key={uuid()}>
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
})

export default page
export { generateMetadata }
