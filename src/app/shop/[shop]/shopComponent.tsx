'use client'

import styles from './shopComponent.module.scss'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { displayAmount } from '@/lib/currency/convert'
import { useState } from 'react'
import { unwrapActionReturn } from '@/app/redirectToErrorPage'
import type { Dispatch, SetStateAction } from 'react'
import type { ExtendedShop } from '@/services/shop/shop/types'
import type { ExtendedProduct } from '@/services/shop/product/types'
import Button from '@/components/UI/Button'
import { createPurchaseAction } from '@/services/shop/actions'

type ProductType = ExtendedProduct & { quantity: number }

type PurchaseOrderType = {
    products: Record<number, ProductType>;
};

type receiptType = {
    products: ProductType[];
    remainingBalance: number;
}


type EditShoppingCartType = Dispatch<SetStateAction<PurchaseOrderType>>

export default function ShopUI({ userId, shopData }: { userId: number; shopData: ExtendedShop }) {
    const [shoppingCart, editShoppingCart] = useState<PurchaseOrderType>({
        products: Object.fromEntries(
            shopData.products.map(product => [
                product.id,
                {
                    ...product,
                    quantity: 0,
                },
            ])
        ),
    })
    const [receipt, editReceipt] = useState<receiptType | null>(null)

    return <PageWrapper
        title={shopData.name}
    >
        <p>{shopData.description}</p>
        <table className={styles.table}>
            <thead>
                <tr>
                    <th>Produkt</th>
                    <th>Beskrivelse</th>
                    <th>Pris pr.stykk</th>
                    <th>Antall</th>
                    <th>Pris total</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {Object.entries(shoppingCart.products).map(([id, product]) =>
                    <tr key={id}>
                        <td>{product.name}</td>
                        <td>{product.description}</td>
                        <td>{displayAmount(product.price, false)}</td>
                        <td>{product.quantity}</td>
                        <td>{displayAmount(product.quantity * product.price, false)}</td>
                        <td>
                            <Button
                                onClick={() => addProduct(product, shoppingCart, editShoppingCart)}
                            >+</Button>
                            {
                                product.quantity <= 0
                                    ?
                                    ''
                                    :
                                    <Button
                                        onClick={() => removeProduct(product, shoppingCart, editShoppingCart)}
                                    >-</Button>
                            }
                        </td>
                    </tr>
                )}
                <tr>
                    <td>SUM:</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>
                        {displayAmount(Object.values(shoppingCart.products).reduce(
                            (total, product) => total + product.quantity * product.price,
                            0
                        ), false)}
                    </td>
                    <td>
                        <Button
                            onClick={() => createPurchase(shoppingCart, shopData.id, userId, editReceipt)}>
                            Kjøp
                        </Button>
                    </td>
                </tr>
            </tbody>
        </table>
        {receipt && <div>
            <h2>Kvittering</h2>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Produkt</th>
                        <th>Beskrivelse</th>
                        <th>Pris pr.stykk</th>
                    </tr>
                </thead>
                <tbody>
                    {shopData.products.map(product =>
                        <tr key={product.id}>
                            <td>{product.name}</td>
                            <td>{product.description}</td>
                            <td>{displayAmount(product.price, false)}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        }

    </PageWrapper>
}

async function createPurchase(
    shoppingCart: PurchaseOrderType,
    shopId: number,
    userId: number,
    editReceipt: Dispatch<SetStateAction<receiptType | null>>) {
    const products = Object.entries(shoppingCart.products).map(
        ([id, product]) => ({
            id: Number(id),
            quantity: product.quantity,
        })
    )

    const purchaseResult = unwrapActionReturn(await createPurchaseAction(
        { params: { userId } },
        {
            data: {
                shopId,
                products: products.filter(product => product.quantity > 0),
            },
        }
    ))
    editReceipt({
        products: purchaseResult.productList,
        remainingBalance: purchaseResult.remainingBalance,
    })


}

function addProduct(product: ExtendedProduct, shoppingCart: PurchaseOrderType, editShoppingCart: EditShoppingCartType) {
    const updatedCart: PurchaseOrderType = {
        ...shoppingCart,
        products: {
            ...shoppingCart.products,
        },
    }
    updatedCart.products[product.id].quantity += 1
    editShoppingCart(updatedCart)
}

function removeProduct(product: ExtendedProduct, shoppingCart: PurchaseOrderType, editShoppingCart: EditShoppingCartType) {
    const updatedCart: PurchaseOrderType = {
        ...shoppingCart,
        products: {
            ...shoppingCart.products,
        },
    }
    updatedCart.products[product.id].quantity -= 1
    if (updatedCart.products[product.id].quantity <= 0) {
        updatedCart.products[product.id].quantity = 0
    }
    editShoppingCart(updatedCart)
}
