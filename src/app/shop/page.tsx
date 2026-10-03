'use server'
import styles from './page.module.scss'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { unwrapActionReturn } from '@/app/redirectToErrorPage'
import { sortObjectsByName } from '@/lib/sortObjects'
import { readShopsAction } from '@/services/shop/actions'
import Link from 'next/link'
import { v4 as uuid } from 'uuid'


export default async function Shops() {
    const shops = unwrapActionReturn(await readShopsAction())

    return <PageWrapper title="Butikker">
        <table className={styles.table}>
            <thead>
                <tr>
                    <th>Butikk</th>
                    <th>Beskrivelse</th>
                </tr>
            </thead>
            <tbody>
                {sortObjectsByName(shops).map(shop =>
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
}
