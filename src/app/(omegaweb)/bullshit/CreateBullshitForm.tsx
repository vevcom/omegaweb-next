'use client'

import styles from './CreateBullshitFrom.module.scss'
import Form from '@/components/Form/Form'
import { createBullshitAction } from '@/services/bullshit/actions'
import Textarea from '@/components/UI/Textarea'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { configureAction } from '@/services/configureAction'
import { useRouter } from 'next/navigation'

type PropTypes = {
    bullshitPosterId: number
}

export default function CreateBullshitForm({ bullshitPosterId }: PropTypes) {
    const { refresh } = useRouter()

    return (
        <AddHeaderItemPopUp popUpKey="new_omega_bullshit">
            <Form
                title="Ny Bullshit"
                submitText="Legg til"
                action={configureAction(createBullshitAction, { params: { bullshitPosterId } })}
                successCallback={refresh}
                className={styles.popupForm}
            >
                <Textarea
                    name="quote"
                    label="Bullshit"
                    placeholder="Bullshit"
                    className={styles.textarea}
                />
            </Form>
        </AddHeaderItemPopUp>
    )
}
