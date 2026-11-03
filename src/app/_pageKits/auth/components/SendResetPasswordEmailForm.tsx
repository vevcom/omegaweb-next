'use client'
import { sendResetPasswordEmailAction } from '@/services/auth/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { useState } from 'react'
import type { SiteName } from '@/lib/sites/site'

export default function SendResetPasswordEmailForm({ site }: { site: SiteName }) {
    const [feedback, setFeedback] = useState('')

    return <>
        <Form
            submitText="Send e-post"
            title="Glemt passord"
            action={configureAction(sendResetPasswordEmailAction, { params: { site } })}
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
