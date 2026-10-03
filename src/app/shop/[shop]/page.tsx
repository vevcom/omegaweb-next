import styles from './page.module.scss'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { unwrapActionReturn } from '@/app/redirectToErrorPage'
import { displayAmount } from '@/lib/currency/convert'
import { sortObjectsByName } from '@/lib/sortObjects'
import { readShopAction } from '@/services/shop/actions'
import { notFound } from 'next/navigation'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'

type PropTypes = {
    params: Promise<{
        shop: string
    }>
}

export default async function Shop({ params }: PropTypes) {
    const shopId = parseInt((await params).shop, 10)
    if (isNaN(shopId)) notFound()

    const shopData = unwrapActionReturn(await readShopAction({
        params: {
            shopId,
        },
    }))

    if (!shopData) notFound()

    const [shoppingCart, editShoppingCart] = useState()
    return <PageWrapper
        title={shopData.name}
    >
        <p>{shopData.description}</p>


        <table className={styles.table}>
            <thead>
                <tr>
                    <th>Produkt</th>
                    <th>Beskrivelse</th>
                    <th>Pris</th>
                    <th>Antall i kurv</th>
                </tr>
            </thead>
            <tbody>
                {sortObjectsByName(shopData.products).map(product => <tr
                    key={uuid()}
                    className={product.active ? '' : styles.deactivatedProduct}
                >
                    <td>{product.name}</td>
                    <td>{product.description}</td>
                    <td>{displayAmount(product.price, false)}</td>
                    <td>{}</td>
                </tr>)}
            </tbody>
        </table>
    </PageWrapper>
}
