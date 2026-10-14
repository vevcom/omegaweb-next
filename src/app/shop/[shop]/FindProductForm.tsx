'use client'
import { createShopProductConnectionAction } from '@/services/shop/product/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import NumberInput from '@/components/UI/NumberInput'
import { SelectNumber } from '@/components/UI/Select'
import type { Product } from '@/prisma-generated-pn-types'

/** Puts a product the shop does not sell yet on sale there. Nothing to pick from, nothing shown. */
export default function FindProductForm({
    shopId,
    products,
}: {
    shopId: number,
    products: Pick<Product, 'id' | 'name'>[]
}) {
    if (products.length === 0) return null

    return <Form
        action={configureAction(createShopProductConnectionAction, { params: { shopId } })}
        submitText="Legg til produkt"
        refreshOnSuccess
        closePopUpOnSuccess="addProductToShop"
    >
        <h3>Eksisterende produkt</h3>
        <SelectNumber name="productId" label="Produkt" options={products.map(product => ({
            label: product.name,
            value: product.id,
        }))} />
        <NumberInput name="price" label="Pris" />
    </Form>
}
