'use client'
import { sendLinkFeideAccountEmailAction } from '@/services/auth/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { useState } from 'react'

type PropTypes = {
    userId: number,
    title?: string,
}

export default function LinkOwUserForm({ userId, title = 'Koble til gammel bruker' }: PropTypes) {
    const [feedback, setFeedback] = useState('')

    return <>
        <Form
            title={title}
            submitText="Send e-post"
            action={configureAction(sendLinkFeideAccountEmailAction, { params: { userId } })}
            successCallback={() => {
                setFeedback(`
                    Hvis brukeren finnes og ikke allerede er koblet til en innlogging, er det sendt
                    en e-post til e-postadressen som er registrert på den, med en lenke for å
                    bekrefte koblingen. Det kan ta noen minutter før den kommer fram.`)
            }}
        >
            <p>
                Hadde du bruker på gamle Omegaveven? Skriv inn det gamle brukernavnet ditt eller
                e-postadressen som var registrert på brukeren, så sender vi en bekreftelseslenke
                dit. Når du har bekreftet, blir denne Feide-innloggingen koblet til den gamle
                brukeren din.
            </p>
            <TextInput label="Gammelt brukernavn eller e-post" name="usernameOrEmail" />
        </Form>
        <p>{feedback}</p>
    </>
}
