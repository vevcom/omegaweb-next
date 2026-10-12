'use client'
import styles from './shopForm.module.scss'
import { createShopAction } from '@/services/shop/actions'
import Form from '@/app/_components/Form/Form'
import TextInput from '@/app/_components/UI/TextInput'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { useState } from 'react'
import type { VisibilityRequirement } from '@/services/visibility/types'


export default function ShopForm() {
    const [adminRequirements, setAdminRequirements] = useState<VisibilityRequirement[]>([])
    const [regularRequirements, setRegularRequirements] = useState<VisibilityRequirement[]>([])

    return <Form
        action={createShopAction}
        className={styles.ShopForm}
        submitText="Lag ny butikk"
        refreshOnSuccess
    >
        <TextInput name="name" label="Butikk" />
        <TextInput name="description" label="Beskrivelse" />
        <div className={styles.visibility}>
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
