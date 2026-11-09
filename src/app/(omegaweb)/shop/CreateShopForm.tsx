'use client'
import { createShopAction } from '@/services/shop/shop/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { appHref } from '@/lib/sites/href'

export default function CreateShopForm() {
    return <Form
        action={createShopAction}
        className="min-w-[50vw]"
        submitText="Lag ny butikk"
        navigateOnSuccess={shop => appHref(shop ? `/shop/${shop.id}` : '/shop')}
    >
        <TextInput name="name" label="Butikk" />
        <TextInput name="description" label="Beskrivelse" />
        {/*
          * The levels are collected here rather than after the fact: a shop created with an empty
          * admin level would be administrable by anyone until it was narrowed.
          */}
        <div className="flex flex-col gap-[0.5rem]">
            <h3>Hvem kan administrere butikken?</h3>
            <VisibilityMatrixEditor name="visibilityAdminRequirements" />
            <h3>Hvem kan handle i butikken? (tomt betyr alle)</h3>
            <VisibilityMatrixEditor name="visibilityRegularRequirements" />
        </div>
    </Form>
}
