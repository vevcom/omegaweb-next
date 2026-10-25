'use client'
import { createShopAction } from '@/services/shop/shop/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { useState } from 'react'
import type { VisibilityRequirement } from '@/services/visibility/types'

export default function CreateShopForm() {
    const [adminRequirements, setAdminRequirements] = useState<VisibilityRequirement[]>([])
    const [regularRequirements, setRegularRequirements] = useState<VisibilityRequirement[]>([])

    return <Form
        action={createShopAction}
        className="min-w-[50vw]"
        submitText="Lag ny butikk"
        navigateOnSuccess={shop => (shop ? `/shop/${shop.id}` : '/shop')}
    >
        <TextInput name="name" label="Butikk" />
        <TextInput name="description" label="Beskrivelse" />
        {/*
          * The levels are collected here rather than after the fact: a shop created with an empty
          * admin level would be administrable by anyone until it was narrowed.
          */}
        <div className="flex flex-col gap-[0.5rem]">
            <h3>Hvem kan administrere butikken?</h3>
            <VisibilityMatrixEditor
                requirements={adminRequirements}
                onChange={setAdminRequirements}
            />
            <input
                type="hidden"
                name="visibilityAdminRequirements"
                value={JSON.stringify(adminRequirements)}
            />
            <h3>Hvem kan handle i butikken? (tomt betyr alle)</h3>
            <VisibilityMatrixEditor
                requirements={regularRequirements}
                onChange={setRegularRequirements}
            />
            <input
                type="hidden"
                name="visibilityRegularRequirements"
                value={JSON.stringify(regularRequirements)}
            />
        </div>
    </Form>
}
