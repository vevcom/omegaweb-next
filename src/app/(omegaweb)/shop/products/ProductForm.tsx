'use client'
import { createProductAction, updateProductAction } from '@/services/shop/product/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import NumberInput from '@/components/UI/NumberInput'
import TextInput from '@/components/UI/TextInput'
import { displayAmount } from '@/lib/currency/convert'
import type { Product } from '@/prisma-generated-pn-types'

export default function ProductForm({
    product
}: {
    product?: Product
}) {
    const submitForm = product
        ? configureAction(updateProductAction, { params: { productId: product.id } })
        : createProductAction

    return <Form
        action={submitForm}
        submitText={product ? 'Oppdater produkt' : 'Lag nytt produkt'}
        refreshOnSuccess
    >
        <TextInput name="name" label="Navn" defaultValue={product?.name} />
        <TextInput name="description" label="Beskrivelse" defaultValue={product?.description} />
        <TextInput name="barcode" label="Strekkode" defaultValue={product?.barcode ?? ''} />
        <NumberInput
            name="suggestedPrice"
            label="Foreslått pris"
            step={0.01}
            min={1}
            defaultValue={product?.suggestedPrice ? displayAmount(product.suggestedPrice, true) : undefined}
        />
    </Form>
}
