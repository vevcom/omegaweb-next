'use client'
import { adminLinkFeideAccountAction } from '@/services/auth/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { useState } from 'react'

/**
 * Admin safety net for the Feide account linking of migrated users: moves the Feide
 * account from an accidentally created duplicate user onto the user's migrated,
 * unclaimed user, and deletes the duplicate.
 */
export default function LinkFeideAccountForm() {
    const [feedback, setFeedback] = useState('')

    return <>
        <Form
            title="Flytt Feide-innlogging"
            submitText="Flytt Feide-innlogging"
            action={adminLinkFeideAccountAction}
            successCallback={() => setFeedback('Feide-innloggingen er flyttet og duplikatbrukeren slettet.')}
        >
            <p>
                Flytter Feide-innloggingen fra en nyopprettet duplikatbruker (som ikke har
                fullført registreringen) til en gammel bruker fra Omegaveven som ikke er
                koblet til noen innlogging, og sletter duplikatbrukeren.
            </p>
            <TextInput label="Brukernavn på duplikatbrukeren" name="fromUsername" />
            <TextInput label="Brukernavn på den gamle brukeren" name="toUsername" />
        </Form>
        <p>{feedback}</p>
    </>
}
