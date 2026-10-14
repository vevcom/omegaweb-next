'use client'
import { updateShopAction } from '@/services/shop/shop/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import type { Shop } from '@/prisma-generated-pn-types'

export default function UpdateShopForm({ shop }: { shop: Pick<Shop, 'id' | 'name' | 'description'> }) {
    return <Form
        action={configureAction(updateShopAction, { params: { shopId: shop.id } })}
        submitText="Oppdater butikk"
        refreshOnSuccess
        closePopUpOnSuccess="shopSettings"
    >
        <TextInput name="name" label="Butikk" defaultValue={shop.name} />
        <TextInput name="description" label="Beskrivelse" defaultValue={shop.description ?? ''} />
    </Form>
}
