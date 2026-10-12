'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { registerNewEmailAction } from '@/services/users/actions'
import { useState } from 'react'
import type { UserFiltered } from '@/services/users/types'

type PropTypes = {
    user: UserFiltered,
}

/**
 * Changes a user's email the way the sign-up flow sets it: the new address is only taken into use
 * once the link sent to it has been followed - unless it is the user's Feide email, which Feide has
 * already verified. A registered user has a password, and has to give it.
 */
export default function ChangeEmailForm({ user }: PropTypes) {
    const [feedback, setFeedback] = useState<string | null>(null)
    const registerNewEmail = configureAction(registerNewEmailAction, { params: { id: user.id } })

    return (
        <>
            <Form
                title="E-post"
                submitText="Endre e-post"
                action={registerNewEmail}
                refreshOnSuccess
                successCallback={data => {
                    if (!data) return
                    setFeedback(data.verified
                        ? `E-posten er ${data.email}.`
                        : `Vi har sendt en bekreftelseslenke til ${data.email}. E-posten endres når lenken er fulgt.`
                    )
                }}
            >
                <p>Nåværende e-post: {user.email}{user.emailVerified ? '' : ' (ikke bekreftet)'}</p>
                <TextInput label="Ny e-post" name="email" defaultValue={user.email} />
                {user.acceptedTerms && <TextInput label="Nåværende passord" name="currentPassword" type="password" />}
            </Form>
            {feedback && <p>{feedback}</p>}
        </>
    )
}
