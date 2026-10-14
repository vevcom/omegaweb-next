'use client'

import styles from './CreateOmegaquoteFrom.module.scss'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import Form from '@/components/Form/Form'
import { createQuoteAction } from '@/services/omegaquotes/actions'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import { configureAction } from '@/services/configureAction'
import { useSession } from '@/auth/session/useSession'
import { useRouter } from 'next/navigation'

export default function CreateOmegaquoteForm() {
    const { refresh } = useRouter()
    const session = useSession()
    if (session.loading || !session.session.user) return null

    return (
        <AddHeaderItemPopUp popUpKey="new_omega_quote">
            <Form
                title="Ny Omegaquote"
                submitText="Legg til"
                action={configureAction(
                    createQuoteAction,
                    { params: { userPosterId: session.session.user?.id } }
                )}
                successCallback={refresh}
                className={styles.popupForm}
            >
                <Textarea
                    name="quote"
                    label="Omegaquote"
                    placeholder="Omegaquote"
                    className={styles.textarea}
                />
                <TextInput label="Sagt av" name="author" className={styles.author}/>
            </Form>
        </AddHeaderItemPopUp>
    )
}
