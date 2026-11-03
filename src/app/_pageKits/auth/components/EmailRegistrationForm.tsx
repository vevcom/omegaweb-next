'use client'
import LinkOwUserForm from './LinkOwUserForm'
import { registerNewEmailAction } from '@/services/users/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { authLinks } from '@/pageKits/auth/links'
import useSiteRouter from '@/hooks/useSiteRouter'
import { useState } from 'react'
import type { AuthPagesConfig } from '@/pageKits/auth/config'
import type { UserFiltered } from '@/services/users/types'

type PropTypes = {
    config: AuthPagesConfig,
    user: UserFiltered,
    feideLoginMatch: {
        feideEmail: string,
        feideEmailTrustedAsVerified: boolean,
        createdByFeideLoginOnOmegawebNext: boolean,
    } | null,
    callbackUrl: string,
}

// A rule on each side of the text.
const dividerClassName = `
    flex justify-center items-center my-2 text-text-muted
    before:m-2 before:flex-1 before:h-0 before:border-b before:border-text-muted
    after:m-2 after:flex-1 after:h-0 after:border-b after:border-text-muted
`

export default function EmailRegistrationForm({ config, user, feideLoginMatch, callbackUrl }: PropTypes) {
    const { push } = useSiteRouter()

    const [feedback, setFeedback] = useState<string | null>(null)

    const actionToCall = configureAction(registerNewEmailAction, { params: { id: user.id, site: config.site } })

    // Only a trusted Feide email is taken without a verification mail, so that is the one offered.
    const trustedFeideEmail = feideLoginMatch?.feideEmailTrustedAsVerified ? feideLoginMatch.feideEmail : null

    const welcome = <>
        <h1>Velkommen til {config.siteName}!</h1>
        {config.accountNotice && <p className="p-2 border-l-3 border-accent-blue">{config.accountNotice}</p>}
    </>

    const emailForm = <>
        <Form
            title={feideLoginMatch?.createdByFeideLoginOnOmegawebNext ? 'A: Opprett ny bruker' : 'Sett e-posten din'}
            submitText="Lagre e-post"
            action={actionToCall}
            successCallback={(data) => {
                if (data) {
                    if (data.verified) {
                        push(authLinks(config).register({ callbackUrl }))
                    } else {
                        setFeedback(`
                            For å bekrefte at dette er din e-post har vi sendt en e-post til ${data.email}.
                            Følg instruksjonene i e-posten for å fullføre registreringen.
                        `)
                    }
                }
            }}
        >
            {feideLoginMatch?.createdByFeideLoginOnOmegawebNext && <p>
                Velg dette hvis du aldri hadde bruker på gamle Omegaveven.
            </p>}
            <p>
                Skriv inn e-posten du vil bruke. Du kan bruke NTNU-e-posten din,
                men vær oppmerksom på at du mister tilgangen til den når du er ferdig med å studere.
            </p>
            {trustedFeideEmail ? <p>
                Feide-e-posten din ({trustedFeideEmail}) er allerede bekreftet. Beholder du den,
                trenger du ikke å bekrefte noe. Velger du en annen e-post, sender vi en bekreftelseslenke dit.
            </p> : <p>
                Vi sender en bekreftelseslenke til e-posten du velger.
            </p>}
            <TextInput label="E-post" name="email" defaultValue={trustedFeideEmail ?? user.email} />
        </Form>

        {feedback && <p>{feedback}</p>}
    </>

    if (!feideLoginMatch) {
        return <>
            {welcome}
            {emailForm}
        </>
    }

    if (!feideLoginMatch.createdByFeideLoginOnOmegawebNext) {
        return <>
            <h1>Vi fant brukeren din!</h1>
            <p className="p-2 border-l-3 border-accent-blue">
                Feide-innloggingen din ({feideLoginMatch.feideEmail}) er koblet til den eksisterende
                brukeren din fra gamle Omegaveven, <strong>{user.firstname} {user.lastname}
                ({user.username})</strong>{user.email === feideLoginMatch.feideEmail && ', fordi e-posten stemte'}.
                Alt som hørte til den gamle brukeren din følger med.
            </p>
            <p>
                Er ikke dette deg? Logg ut og ta kontakt med VevCom før du fortsetter.
            </p>
            {emailForm}
        </>
    }

    return <>
        {welcome}
        <p className="p-2 border-l-3 border-accent-blue">
            Vi fant ingen bruker fra gamle Omegaveven med Feide-e-posten din
            ({feideLoginMatch.feideEmail}). Hadde du bruker der, var den trolig registrert med en annen
            e-post. Du har to valg:
        </p>
        <div className="w-full">
            {emailForm}
        </div>
        <div className={dividerClassName}>eller</div>
        <div className="w-full">
            <LinkOwUserForm site={config.site} userId={user.id} title="B: Koble til eksisterende bruker" />
        </div>
    </>
}
