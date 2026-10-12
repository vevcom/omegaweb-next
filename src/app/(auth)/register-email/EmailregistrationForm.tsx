'use client'
import styles from './EmailregistrationForm.module.scss'
import LinkOwUserForm from '@/app/(auth)/link-ow-user/LinkOwUserForm'
import { registerNewEmailAction } from '@/services/users/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { UserFiltered } from '@/services/users/types'

type PropTypes = {
    user: UserFiltered,
    feideLoginMatch: {
        feideEmail: string,
        createdByFeideLoginOnProjectNext: boolean,
    } | null,
    callbackUrl: string,
}

export default function EmailRegistrationForm({ user, feideLoginMatch, callbackUrl }: PropTypes) {
    const { push } = useRouter()

    const [feedback, setFeedback] = useState<string | null>(null)

    const actionToCall = configureAction(registerNewEmailAction, { params: { id: user.id } })

    const emailForm = <>
        <Form
            title={feideLoginMatch?.createdByFeideLoginOnProjectNext ? 'A: Opprett ny bruker' : 'Sett e-posten din'}
            submitText="Lagre e-post"
            action={actionToCall}
            successCallback={(data) => {
                if (data) {
                    if (data.verified) {
                        push(`/register?${QueryParams.callbackUrl.encodeUrl(callbackUrl)}`)
                    } else {
                        setFeedback(`
                            For å bekrefte at dette er din e-post har vi sendt en e-post til ${data.email}.
                            Følg instruksjonene i e-posten for å fullføre registreringen.
                        `)
                    }
                }
            }}
        >
            {feideLoginMatch?.createdByFeideLoginOnProjectNext && <p>
                Velg dette hvis du aldri hadde bruker på gamle Omegaveven.
            </p>}
            <p>
                Skriv inn e-posten du vil bruke. Du kan bruke ntnu-e-posten din,
                men vær oppmerksom på at du mister tilgang til denne når du er ferdig å studere.
            </p>
            {feideLoginMatch && <p>
                Feide-e-posten din ({feideLoginMatch.feideEmail}) er allerede bekreftet, så beholder du den
                trenger du ikke bekrefte noe. Velger du en annen e-post, sender vi en bekreftelseslenke dit.
            </p>}
            <TextInput label="E-post" name="email" defaultValue={user.email} />
        </Form>

        {feedback && <p>{feedback}</p>}
    </>

    if (!feideLoginMatch) {
        return <>
            <h1>Velkommen til Veven!</h1>
            {emailForm}
        </>
    }

    if (!feideLoginMatch.createdByFeideLoginOnProjectNext) {
        return <>
            <h1>Vi fant brukeren din!</h1>
            <p className={styles.notice}>
                Feide-innloggingen din ({feideLoginMatch.feideEmail}) er koblet til den eksisterende
                brukeren din fra gamle Omegaveven, <strong>{user.firstname} {user.lastname}
                ({user.username})</strong>, fordi e-posten stemte. Alt som hørte til den gamle brukeren
                din følger med.
            </p>
            <p>
                Er ikke dette deg? Logg ut og ta kontakt med Vevcom før du fortsetter.
            </p>
            {emailForm}
        </>
    }

    return <>
        <h1>Velkommen til Veven!</h1>
        <p className={styles.notice}>
            Vi fant ingen bruker fra gamle Omegaveven med Feide-e-posten din
            ({feideLoginMatch.feideEmail}). Hadde du bruker der, var den trolig registrert med en annen
            e-post. Du har to valg:
        </p>
        <div className={styles.option}>
            {emailForm}
        </div>
        <div className={styles.divider}>eller</div>
        <div className={styles.option}>
            <LinkOwUserForm title="B: Koble til eksisterende bruker" />
        </div>
    </>
}
