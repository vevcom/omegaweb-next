'use client'

import Form from '@/components/Form/Form'
import { createBulshitAction } from '@/services/bulshit/actions'
import Textarea from '@/components/UI/Textarea'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { configureAction } from '@/services/configureAction'
import useSiteRouter from '@/hooks/useSiteRouter'

type PropTypes = {
    bulshitPosterId: number
}

export default function CreateBulshitForm({ bulshitPosterId }: PropTypes) {
    const { refresh } = useSiteRouter()

    return (
        <AddHeaderItemPopUp popUpKey="new_omega_bulshit">
            <Form
                title="Ny Bulshit"
                submitText="Legg til"
                action={configureAction(createBulshitAction, { params: { bulshitPosterId } })}
                successCallback={refresh}
                className="
                    w-[400px]
                    [&_input]:w-full
                "
            >
                <Textarea
                    name="quote"
                    label="Bulshit"
                    placeholder="Bulshit"
                    className="h-[100px] max-h-[300px]"
                />
            </Form>
        </AddHeaderItemPopUp>
    )
}
