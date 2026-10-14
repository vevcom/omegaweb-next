'use client'

import styles from './ShopUI.module.scss'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { displayAmount } from '@/lib/currency/convert'
import Button from '@/components/UI/Button'
import { createPurchaseAction } from '@/services/shop/purchase/actions'
import { useState } from 'react'
import Link from 'next/link'
import type { ExtendedProduct } from '@/services/shop/product/types'
import type { ExtendedShop } from '@/services/shop/shop/types'
import type { Dispatch, SetStateAction } from 'react'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type ProductInCart = ExtendedProduct & { quantity: number }

type ShoppingCart = {
    products: Record<number, ProductInCart>,
}

type Receipt = {
    products: ProductInCart[],
    remainingBalance: number,
}

type EditShoppingCart = Dispatch<SetStateAction<ShoppingCart>>

export default function ShopUI({ shop, userId, capabilities }: {
    shop: ExtendedShop,
    /** The viewer, who is charged for what they buy. Null for a visitor, who cannot buy. */
    userId: number | null,
    capabilities: CapabilitiesJsObject<'canAdminister' | 'canPurchase'>,
}) {
    const [shoppingCart, editShoppingCart] = useState<ShoppingCart>({
        products: Object.fromEntries(
            shop.products.map(product => [
                product.id,
                {
                    ...product,
                    quantity: 0,
                },
            ])
        ),
    })
    const [receipt, editReceipt] = useState<Receipt | null>(null)

    return <PageWrapper>
        <p>{shop.description}</p>
        {capabilities.canAdminister.authorized && (
            <Link href={`/admin/shop/${shop.id}`}>Administrer butikken</Link>
        )}
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
                            {product.quantity > 0 && (
                                <Button
                                    onClick={() => removeProduct(product, shoppingCart, editShoppingCart)}
                                >-</Button>
                            )}
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
                        {capabilities.canPurchase.authorized && userId !== null && (
                            <Button
                                onClick={() => createPurchase(shoppingCart, shop.id, userId, editReceipt)}>
                                Kjøp
                            </Button>
                        )}
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
                        <th>Antall</th>
                        <th>Pris total</th>
                    </tr>
                </thead>
                <tbody>
                    {receipt.products.map(product =>
                        <tr key={product.id}>
                            <td>{product.name}</td>
                            <td>{product.description}</td>
                            <td>{displayAmount(product.price, false)}</td>
                            <td>{product.quantity}</td>
                            <td>{displayAmount(product.quantity * product.price, false)}</td>
                        </tr>
                    )}
                </tbody>
            </table>
            <p>Gjenstående saldo: {displayAmount(receipt.remainingBalance, false)}</p>
        </div>}
    </PageWrapper>
}

async function createPurchase(
    shoppingCart: ShoppingCart,
    shopId: number,
    userId: number,
    editReceipt: Dispatch<SetStateAction<Receipt | null>>,
) {
    const products = Object.values(shoppingCart.products)
        .filter(product => product.quantity > 0)
        .map(product => ({
            id: product.id,
            quantity: product.quantity,
        }))

    const purchaseResult = await createPurchaseAction(
        { params: { userId } },
        { data: { shopId, products } },
    )

    if (purchaseResult.success) {
        // The purchase returns each line as id, quantity and the unit price it was charged at;
        // the cart still knows the product behind the id.
        editReceipt({
            products: purchaseResult.data.productList.map(line => ({
                ...shoppingCart.products[line.productId],
                quantity: line.quantity,
                price: line.price,
            })),
            remainingBalance: purchaseResult.data.remainingBalance,
        })
    }
}

function addProduct(product: ExtendedProduct, shoppingCart: ShoppingCart, editShoppingCart: EditShoppingCart) {
    editShoppingCart(withQuantity(shoppingCart, product.id, shoppingCart.products[product.id].quantity + 1))
}

function removeProduct(product: ExtendedProduct, shoppingCart: ShoppingCart, editShoppingCart: EditShoppingCart) {
    editShoppingCart(withQuantity(shoppingCart, product.id, Math.max(0, shoppingCart.products[product.id].quantity - 1)))
}

/** The cart with one product's quantity changed, as a new object so React re-renders. */
function withQuantity(shoppingCart: ShoppingCart, productId: number, quantity: number): ShoppingCart {
    return {
        ...shoppingCart,
        products: {
            ...shoppingCart.products,
            [productId]: { ...shoppingCart.products[productId], quantity },
        },
    }
}
