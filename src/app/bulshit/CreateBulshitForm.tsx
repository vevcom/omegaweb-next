'use client'

import styles from './CreateBulshitForm.module.scss'
import Form from '@/components/Form/Form'
import { createBulshitAction } from '@/services/bulshit/actions'
import Textarea from '@/components/UI/Textarea'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { configureAction } from '@/services/configureAction'
import { useRouter } from 'next/navigation'

type PropTypes = {
    bulshitPosterId: number
}

export default function CreateBulshitForm({ bulshitPosterId }: PropTypes) {
    const { refresh } = useRouter()

    return (
        <AddHeaderItemPopUp popUpKey="new_omega_bulshit">
            <Form
                title="Ny Bulshit"
                submitText="Legg til"
                action={configureAction(createBulshitAction, { params: { bulshitPosterId } })}
                successCallback={refresh}
                className={styles.popupForm}
            >
                <Textarea
                    name="quote"
                    label="Bulshit"
                    placeholder="Bulshit"
                    className={styles.textarea}
                />
            </Form>
        </AddHeaderItemPopUp>
    )
}
