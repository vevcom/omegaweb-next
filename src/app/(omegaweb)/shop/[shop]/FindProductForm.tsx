'use client'
import { connectShopProductAction } from '@/services/shop/shop/actions'
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
        action={configureAction(connectShopProductAction, { params: { shopId } })}
        submitText="Legg til produkt"
        refreshOnSuccess
        closePopUpOnSuccess="addProductToShop"
    >
        <h3>Eksisterende produkt</h3>
        <SelectNumber name="productId" label="Produkt" options={products.map(product => ({
            label: product.name,
            value: product.id,
        }))} />
        <NumberInput name="optionalPrice" label="Pris (tom for produktets foreslåtte pris)" step={0.01} min={1} />
    </Form>
}
