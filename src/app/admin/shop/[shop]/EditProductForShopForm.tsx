'use client'
import { createProductForShopAction, updateProductForShopAction } from '@/services/shop/product/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/app/_components/Form/Form'
import Checkbox from '@/app/_components/UI/Checkbox'
import NumberInput from '@/app/_components/UI/NumberInput'
import TextInput from '@/app/_components/UI/TextInput'
import { displayAmount } from '@/lib/currency/convert'
import type { ExtendedProduct } from '@/services/shop/product/types'


export function EditProductForShopForm({
    shopId,
    product,
}: {
    shopId: number,
    product?: ExtendedProduct,
}) {
    const submitAction = product
        ? configureAction(updateProductForShopAction, { params: { shopId, productId: product.id } })
        : configureAction(createProductForShopAction, { params: { shopId } })

    return <Form
        action={submitAction}
        submitText={product ? 'Oppdater produkt' : 'Lag nytt produkt'}
    >
        <TextInput name="name" label="Navn" defaultValue={product?.name}/>
        <TextInput name="description" label="Beskrivelse" defaultValue={product?.description}/>
        <TextInput name="barcode" label="Strekkode" defaultValue={product?.barcode ?? ''}/>
        {product && <Checkbox name="active" label="Aktiv" defaultChecked={product.active} />}
        <NumberInput name="price" label="Pris" defaultValue={product ? displayAmount(product.price, true) : undefined}/>
    </Form>
}
