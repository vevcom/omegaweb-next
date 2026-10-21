'use client'

import ProductCard from './ProductCard'
import Button from '@/components/UI/Button'
import { displayAmount } from '@/lib/currency/convert'
import { createPurchaseAction } from '@/services/shop/purchase/actions'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBasketShopping, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import type { ExtendedShop, ShopPageProduct } from '@/services/shop/shop/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type CartLine = {
    product: ShopPageProduct,
    quantity: number,
}

type Receipt = {
    lines: CartLine[],
    remainingBalance: number,
}

/**
 * The shop's products as a shelf to buy from, with the cart beside it. Those who administer the
 * shop's products also see the ones taken off sale, and get to edit each product in place.
 */
export default function ShopUI({ shop, userId, capabilities }: {
    shop: ExtendedShop,
    /** The viewer, who is charged for what they buy. Null for a visitor, who cannot buy. */
    userId: number | null,
    capabilities: CapabilitiesJsObject<'canPurchase' | 'canUpdateProduct'>,
}) {
    const products = shop.products
        .filter(product => product.active || capabilities.canUpdateProduct.authorized)
        .sort((first, second) => Number(second.active) - Number(first.active) || first.name.localeCompare(second.name))
    const [quantities, setQuantities] = useState<Record<number, number>>({})
    const [receipt, setReceipt] = useState<Receipt | null>(null)
    const [purchasing, setPurchasing] = useState(false)
    const [purchaseError, setPurchaseError] = useState<string | null>(null)

    const cart: CartLine[] = products
        .filter(product => product.active)
        .map(product => ({ product, quantity: quantities[product.id] ?? 0 }))
        .filter(line => line.quantity > 0)
    const itemCount = cart.reduce((count, line) => count + line.quantity, 0)
    const total = cart.reduce((sum, line) => sum + line.quantity * line.product.price, 0)

    const changeQuantity = (productId: number, change: number) => {
        // A successful purchase empties the cart, which would drop anything added while it ran.
        if (purchasing) return
        setReceipt(null)
        setQuantities(current => ({ ...current, [productId]: Math.max(0, (current[productId] ?? 0) + change) }))
    }

    const purchase = async (buyerId: number) => {
        setPurchasing(true)
        setPurchaseError(null)
        try {
            const purchaseResult = await createPurchaseAction(
                { params: { userId: buyerId } },
                {
                    data: {
                        shopId: shop.id,
                        products: cart.map(line => ({ id: line.product.id, quantity: line.quantity })),
                    },
                },
            )
            if (!purchaseResult.success) {
                setPurchaseError(purchaseResult.error?.map(({ message }) => message).join(' ') || 'Kjøpet feilet.')
                return
            }

            // The purchase returns each line as id, quantity and the unit price it was charged at.
            const productsById = new Map(products.map(product => [product.id, product]))
            setReceipt({
                lines: purchaseResult.data.productList.flatMap(line => {
                    const product = productsById.get(line.productId)
                    return product ? [{ product: { ...product, price: line.price }, quantity: line.quantity }] : []
                }),
                remainingBalance: purchaseResult.data.remainingBalance,
            })
            // Emptied, so a second click does not buy the same cart again.
            setQuantities({})
        } catch {
            // The request may have reached the server before it failed, so a retry could charge twice.
            setPurchaseError('Noe gikk galt. Sjekk saldoen din før du prøver igjen.')
        } finally {
            setPurchasing(false)
        }
    }

    return (
        <div className="
            grid items-start gap-6
            mobile:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]
        ">
            {products.length === 0 ? (
                <div className="
                    grid place-items-center gap-2 rounded-round bg-surface-raised p-12 text-center text-text-muted
                ">
                    <FontAwesomeIcon icon={faBasketShopping} className="
                        size-10! text-inherit
                        [&_path]:text-inherit
                    " />
                    <p className="m-0">Butikken har ingen varer ennå.</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                    {products.map(product => (
                        <ProductCard
                            key={product.id}
                            shop={shop}
                            product={product}
                            quantity={quantities[product.id] ?? 0}
                            canUpdateProduct={capabilities.canUpdateProduct.authorized}
                            onAdd={() => changeQuantity(product.id, 1)}
                            onRemove={() => changeQuantity(product.id, -1)}
                        />
                    ))}
                </div>
            )}

            <aside className="
                sticky z-2 flex flex-col gap-4 rounded-round bg-surface-raised p-5
                mobile:top-0
                max-mobile:bottom-0 max-mobile:max-h-[60dvh] max-mobile:overflow-y-auto
            ">
                {receipt ? (
                    <>
                        <div className="flex items-center gap-3 text-accent-green">
                            <FontAwesomeIcon icon={faCircleCheck} className="
                                size-7! text-inherit
                                [&_path]:text-inherit
                            " />
                            <h2 className="m-0 text-l text-text">Takk for kjøpet!</h2>
                        </div>
                        <ul className="m-0 flex list-none flex-col gap-2 p-0">
                            {receipt.lines.map(line => (
                                <li key={line.product.id} className="flex justify-between gap-2 text-s">
                                    <span>{line.quantity} × {line.product.name}</span>
                                    <span className="tabular-nums">{displayAmount(line.quantity * line.product.price)}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="m-0 flex justify-between border-t border-surface-hover pt-3 text-s text-text-muted">
                            <span>Gjenstående saldo</span>
                            <span className="tabular-nums">{displayAmount(receipt.remainingBalance, false)}</span>
                        </p>
                        <Button color="secondary" className="m-0!" onClick={() => setReceipt(null)}>Handle mer</Button>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <h2 className="m-0 flex items-center gap-2 text-l">
                                <FontAwesomeIcon icon={faBasketShopping} className="
                                    size-5! text-inherit
                                    [&_path]:text-inherit
                                " />
                                Handlekurv
                            </h2>
                            {itemCount > 0 && (
                                <span className="text-s text-text-muted">
                                    {itemCount} {itemCount === 1 ? 'vare' : 'varer'}
                                </span>
                            )}
                        </div>
                        {cart.length === 0 ? (
                            <p className="
                                m-0 text-s text-text-muted
                                max-mobile:hidden
                            ">Legg til varer for å handle.</p>
                        ) : (
                            <ul className="
                                m-0 flex list-none flex-col gap-2 p-0
                                max-mobile:hidden
                            ">
                                {cart.map(line => (
                                    <li key={line.product.id} className="flex justify-between gap-2 text-s">
                                        <span className="wrap-anywhere">{line.quantity} × {line.product.name}</span>
                                        <span className="shrink-0 tabular-nums">
                                            {displayAmount(line.quantity * line.product.price)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex items-baseline justify-between border-t border-surface-hover pt-3">
                            <span className="font-medium">Totalt</span>
                            <span className="text-xl font-bold tabular-nums">{displayAmount(total)}</span>
                        </div>
                        {capabilities.canPurchase.authorized && userId !== null ? (
                            <Button
                                className="m-0! w-full"
                                disabled={purchasing || cart.length === 0}
                                onClick={() => purchase(userId)}
                            >
                                {purchasing ? 'Kjøper...' : 'Kjøp'}
                            </Button>
                        ) : (
                            <p className="m-0 text-s text-text-muted">
                                {userId === null ? 'Logg inn for å handle.' : 'Du har ikke tilgang til å handle her.'}
                            </p>
                        )}
                        {purchaseError && <p className="m-0 text-s text-accent-red">{purchaseError}</p>}
                    </>
                )}
            </aside>
        </div>
    )
}
