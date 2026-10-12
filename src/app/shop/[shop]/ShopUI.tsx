'use client'

import styles from './ShopUI.module.scss'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { displayAmount } from '@/lib/currency/convert'
import Button from '@/components/UI/Button'
import useAuthorizer from '@/hooks/useAuthorizer'
import { createPurchaseAction } from '@/services/shop/actions'
import { purchaseAuth } from '@/services/shop/purchase/auth'
import { useState } from 'react'
import Link from 'next/link'
import type { ExtendedProduct } from '@/services/shop/product/types'
import type { ExtendedShop } from '@/services/shop/shop/types'
import type { Dispatch, SetStateAction } from 'react'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type ProductType = ExtendedProduct & { quantity: number }

type PurchaseOrderType = {
    products: Record<number, ProductType>;
};

type receiptType = {
    products: ProductType[];
    remainingBalance: number;
}

type EditShoppingCartType = Dispatch<SetStateAction<PurchaseOrderType>>

export default function ShopUI({ userId, shopData, capabilities }: {
    userId: number,
    shopData: ExtendedShop,
    capabilities: CapabilitiesJsObject<'canAdminister'>,
}) {
    const canPurchase = useAuthorizer({
        authorizer: purchaseAuth.create.data({ userId, visibility: shopData.visibility })
    }).authorized
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

    return <PageWrapper>
        <p>{shopData.description}</p>
        {capabilities.canAdminister.authorized && (
            <Link href={`/admin/shop/${shopData.id}`}>Administrer butikken</Link>
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
                        {canPurchase && (
                            <Button
                                onClick={() => createPurchase(shoppingCart, shopData.id, userId, editReceipt)}>
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

    const purchaseResult = await createPurchaseAction(
        { params: { userId } },
        {
            data: {
                shopId,
                products: products.filter(product => product.quantity > 0),
            },
        }
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
