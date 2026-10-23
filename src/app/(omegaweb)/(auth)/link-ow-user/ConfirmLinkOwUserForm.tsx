'use client'
import { linkFeideAccountAction } from '@/services/auth/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import Link from 'next/link'
import { useState } from 'react'

type PropTypes = {
    token: string,
    linkRequest: {
        targetUsername: string,
        feideName: string,
        feideEmail: string,
    },
}

export default function ConfirmLinkOwUserForm({ token, linkRequest }: PropTypes) {
    const [linked, setLinked] = useState(false)

    if (linked) {
        return <>
            <h1>Brukeren er koblet!</h1>
            <p>
                Feide-innloggingen er nå koblet til den gamle brukeren din.
                Logg inn med Feide på nytt for å fortsette registreringen.
            </p>
            <Link href="/login">Til innlogging</Link>
        </>
    }

    return <Form
        title="Bekreft kobling"
        submitText="Koble Feide-innloggingen til denne brukeren"
        action={configureAction(linkFeideAccountAction, { params: { token } })}
        successCallback={() => setLinked(true)}
    >
        <p>
            Du er i ferd med å koble Feide-innloggingen til
            {' '}<strong>{linkRequest.feideName} ({linkRequest.feideEmail})</strong>{' '}
            til den gamle brukeren din fra Omegaveven, <strong>{linkRequest.targetUsername}</strong>.
            Etterpå kan denne Feide-innloggingen logge inn som deg.
        </p>
        <p>
            <strong>Er ikke dette din Feide-innlogging, skal du ikke bekrefte.</strong>
        </p>
        <p>
            Den midlertidige brukeren som ble opprettet ved Feide-innloggingen blir slettet,
            og du må logge inn med Feide på nytt etterpå.
        </p>
    </Form>
}
