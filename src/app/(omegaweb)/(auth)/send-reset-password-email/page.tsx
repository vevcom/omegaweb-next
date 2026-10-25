'use client'
import { sendResetPasswordEmailAction } from '@/services/auth/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { useState } from 'react'


export default function ResetPassword() {
    const [feedback, setFeedback] = useState('')

    return <>
        <Form
            submitText="Send e-post"
            title="Glemt passord"
            action={sendResetPasswordEmailAction}
            successCallback={(email) => {
                setFeedback(`
                    Hvis e-posten finnes i databasen, er en e-post er sendt til ${email} med instruksjoner for
                    å nullstille passordet. Det kan ta noen minutter før den kommer fram`)
            }}
        >
            <TextInput label="E-post" name="email" />
        </Form>
        <p>{ feedback }</p>
    </>
}
