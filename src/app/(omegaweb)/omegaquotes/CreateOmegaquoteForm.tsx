'use client'

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
        <AddHeaderItemPopUp title="Ny Omegaquote" popUpKey="new_omega_quote">
            <Form
                submitText="Legg til"
                action={configureAction(
                    createQuoteAction,
                    { params: { userPosterId: session.session.user?.id } }
                )}
                successCallback={refresh}
                className="w-[400px]"
            >
                <Textarea
                    name="quote"
                    label="Omegaquote"
                    placeholder="Omegaquote"
                    className="h-[100px] max-h-[300px]"
                />
                <TextInput label="Sagt av" name="author" className="
                    w-full max-w-full
                    [&_input]:w-full
                "/>
            </Form>
        </AddHeaderItemPopUp>
    )
}
