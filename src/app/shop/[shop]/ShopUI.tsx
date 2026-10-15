'use client'

import styles from './ShopUI.module.scss'
import { EditProductForShopForm } from './EditProductForShopForm'
import PopUp from '@/components/PopUp/PopUp'
import Button from '@/components/UI/Button'
import { displayAmount } from '@/lib/currency/convert'
import { createPurchaseAction } from '@/services/shop/purchase/actions'
import { useState } from 'react'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ExtendedShop, ShopPageProduct } from '@/services/shop/shop/types'
import type { Dispatch, SetStateAction } from 'react'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type ProductInCart = ShopPageProduct & { quantity: number }

type ShoppingCart = {
    products: Record<number, ProductInCart>,
}

type Receipt = {
    products: ProductInCart[],
    remainingBalance: number,
}

type EditShoppingCart = Dispatch<SetStateAction<ShoppingCart>>

/**
 * The shop's products as a cart to buy from. Those who administer the shop's products also see
 * the ones taken off sale, and get to edit each product in place.
 */
export default function ShopUI({ shop, userId, capabilities }: {
    shop: ExtendedShop,
    /** The viewer, who is charged for what they buy. Null for a visitor, who cannot buy. */
    userId: number | null,
    capabilities: CapabilitiesJsObject<'canPurchase' | 'canUpdateProduct'>,
}) {
    const [shoppingCart, editShoppingCart] = useState<ShoppingCart>({
        products: Object.fromEntries(
            shop.products
                .filter(product => product.active || capabilities.canUpdateProduct.authorized)
                .map(product => [
                    product.id,
                    {
                        ...product,
                        quantity: 0,
                    },
                ])
        ),
    })
    const [receipt, editReceipt] = useState<Receipt | null>(null)
    const [purchasing, setPurchasing] = useState(false)
    const [purchaseError, setPurchaseError] = useState<string | null>(null)

    const purchase = async (buyerId: number) => {
        setPurchasing(true)
        setPurchaseError(null)
        try {
            const purchaseResult = await createPurchaseAction(
                { params: { userId: buyerId } },
                { data: { shopId: shop.id, products: orderLines(shoppingCart) } },
            )
            if (!purchaseResult.success) {
                setPurchaseError(purchaseResult.error?.map(({ message }) => message).join(' ') || 'Kjøpet feilet.')
                return
            }

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
            // Emptied, so a second click does not buy the same cart again.
            editShoppingCart(emptied)
        } catch {
            // The request may have reached the server before it failed, so a retry could charge twice.
            setPurchaseError('Noe gikk galt. Sjekk saldoen din før du prøver igjen.')
        } finally {
            setPurchasing(false)
        }
    }

    return <>
        <table className={styles.table}>
            <thead>
                <tr>
                    {capabilities.canUpdateProduct.authorized && <th>Rediger</th>}
                    <th>Produkt</th>
                    <th>Beskrivelse</th>
                    <th>Pris pr.stykk</th>
                    <th>Antall</th>
                    <th>Pris total</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {Object.values(shoppingCart.products).map(product =>
                    <tr key={product.id} className={product.active ? '' : styles.deactivatedProduct}>
                        {capabilities.canUpdateProduct.authorized && (
                            <td className={styles.editButtonWrapper}>
                                <PopUp
                                    showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                                    popUpKey={`editProductForShop-${product.id}`}
                                >
                                    <EditProductForShopForm
                                        shop={shop}
                                        product={product}
                                        closePopUpOnSuccess={`editProductForShop-${product.id}`}
                                    />
                                </PopUp>
                            </td>
                        )}
                        <td>{product.name}</td>
                        <td>{product.description}</td>
                        <td>{displayAmount(product.price, false)}</td>
                        <td>{product.quantity}</td>
                        <td>{displayAmount(product.quantity * product.price, false)}</td>
                        <td>
                            {product.active && <>
                                <Button
                                    onClick={() => addProduct(product, shoppingCart, editShoppingCart)}
                                >+</Button>
                                {product.quantity > 0 && (
                                    <Button
                                        onClick={() => removeProduct(product, shoppingCart, editShoppingCart)}
                                    >-</Button>
                                )}
                            </>}
                        </td>
                    </tr>
                )}
                <tr>
                    {capabilities.canUpdateProduct.authorized && <td></td>}
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
                            <Button disabled={purchasing} onClick={() => purchase(userId)}>
                                {purchasing ? 'Kjøper...' : 'Kjøp'}
                            </Button>
                        )}
                    </td>
                </tr>
            </tbody>
        </table>
        {purchaseError && <p className={styles.error}>{purchaseError}</p>}
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
    </>
}

/** What the cart holds, as the lines of a purchase. */
function orderLines(shoppingCart: ShoppingCart) {
    return Object.values(shoppingCart.products)
        .filter(product => product.quantity > 0)
        .map(product => ({
            id: product.id,
            quantity: product.quantity,
        }))
}

/** The cart with every quantity back at 0. */
function emptied(shoppingCart: ShoppingCart): ShoppingCart {
    return {
        ...shoppingCart,
        products: Object.fromEntries(
            Object.entries(shoppingCart.products).map(([productId, product]) => [productId, { ...product, quantity: 0 }])
        ),
    }
}

function addProduct(product: ShopPageProduct, shoppingCart: ShoppingCart, editShoppingCart: EditShoppingCart) {
    editShoppingCart(withQuantity(shoppingCart, product.id, shoppingCart.products[product.id].quantity + 1))
}

function removeProduct(product: ShopPageProduct, shoppingCart: ShoppingCart, editShoppingCart: EditShoppingCart) {
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
