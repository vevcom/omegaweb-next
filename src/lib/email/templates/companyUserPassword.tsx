import '@pn-server-only'

import { companyUserPasswordExpiration } from '@/lib/email/systemMail/constants'
import { Html } from '@react-email/components'

/**
 * The mail a company user gets to choose a password: the first time, to be able to sign in at all,
 * and later to replace one they have forgotten.
 */
export function CompanyUserPasswordTemplate({
    firstname,
    companyName,
    email,
    link,
}: {
    firstname: string,
    companyName: string,
    email: string,
    link: string,
}) {
    return (
        <Html>
            <h1>Velg passord</h1>

            <p>Hei {firstname},</p>

            <p>
                Du er registrert som bruker for {companyName} hos Contactor.
                Trykk på denne <a href={link}>lenken</a> for å velge et passord og logge inn.
                Lenken blir ugyldig etter {companyUserPasswordExpiration / (60 * 60)} timer, og når passordet er valgt.
            </p>

            <p>Du logger inn med e-postadressen din, <strong>{email}</strong>.</p>

            <p>Hvis du ikke kjenner til dette, kan du bare se bort fra denne e-posten.</p>

            <p>
                Med vennlig hilsen<br/>
                Contactor
            </p>
        </Html>
    )
}
