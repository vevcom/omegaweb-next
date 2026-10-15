'use client'
import { createProductForShopAction, updateProductForShopAction } from '@/services/shop/product/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import Checkbox from '@/components/UI/Checkbox'
import NumberInput from '@/components/UI/NumberInput'
import TextInput from '@/components/UI/TextInput'
import { displayAmount } from '@/lib/currency/convert'
import type { ExtendedProduct } from '@/services/shop/product/types'
import type { PopUpKeyType } from '@/contexts/PopUp'

/** Creates a product on sale in the shop, or, given a product, updates it as the shop sells it. */
export function EditProductForShopForm({
    shopId,
    product,
    closePopUpOnSuccess,
}: {
    shopId: number,
    product?: ExtendedProduct,
    closePopUpOnSuccess?: PopUpKeyType,
}) {
    const submitAction = product
        ? configureAction(updateProductForShopAction, { params: { shopId, productId: product.id } })
        : configureAction(createProductForShopAction, { params: { shopId } })

    return <Form
        action={submitAction}
        submitText={product ? 'Oppdater produkt' : 'Lag nytt produkt'}
        refreshOnSuccess
        closePopUpOnSuccess={closePopUpOnSuccess}
    >
        {!product && <h3>Nytt produkt</h3>}
        <TextInput name="name" label="Navn" defaultValue={product?.name}/>
        <TextInput name="description" label="Beskrivelse" defaultValue={product?.description}/>
        <TextInput name="barcode" label="Strekkode" defaultValue={product?.barcode ?? ''}/>
        {product && <Checkbox name="active" label="Aktiv" defaultChecked={product.active} />}
        <NumberInput
            name="price"
            label="Pris"
            step={0.01}
            min={1}
            defaultValue={product ? displayAmount(product.price, true) : undefined}
        />
    </Form>
}
