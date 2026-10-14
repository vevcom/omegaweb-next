'use client'
import { createProductAction, updateProductAction } from '@/services/shop/product/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/app/_components/Form/Form'
import TextInput from '@/app/_components/UI/TextInput'
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
    </Form>
}
