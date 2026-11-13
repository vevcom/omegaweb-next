'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { useState } from 'react'
import type { ActionFormData } from '@/services/actionTypes'

type PropTypes = {
    /** Sends the mail to the address typed, and hands the address back. Each kind of account has its own. */
    action: ActionFormData<string>,
}

export default function SendResetPasswordEmailForm({ action }: PropTypes) {
    const [feedback, setFeedback] = useState('')

    return <>
        <Form
            submitText="Send e-post"
            title="Glemt passord"
            action={action}
            successCallback={(email) => {
                setFeedback(`
                    Hvis e-posten finnes i databasen, har vi sendt en e-post til ${email} med instruksjoner for
                    å nullstille passordet. Det kan ta noen minutter før den kommer fram.`)
            }}
        >
            <TextInput label="E-post" name="email" />
        </Form>
        <p>{ feedback }</p>
    </>
}
