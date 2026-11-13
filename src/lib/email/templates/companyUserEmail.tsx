import '@pn-server-only'

import { Html } from '@react-email/components'

/** Asks a company user to confirm that a new email is theirs. */
export function CompanyUserVerifyEmailTemplate({ firstname, link }: { firstname: string, link: string }) {
    return (
        <Html>
            <p>Hei {firstname},</p>

            <p>
                Denne e-postadressen er oppgitt som ny adresse for bedriftsbrukeren din hos Contactor.
                Bekreft at den er din ved å trykke på <a href={link}>lenken</a>.
            </p>

            <p>Hvis du ikke kjenner til dette, kan du bare se bort fra denne e-posten.</p>

            <p>
                Med vennlig hilsen<br/>
                Contactor
            </p>
        </Html>
    )
}

/** Tells the old address of a company user that the email was changed. */
export function CompanyUserEmailChangedTemplate({ firstname, newEmail }: { firstname: string, newEmail: string }) {
    return (
        <Html>
            <p>Hei {firstname},</p>

            <p>
                E-posten til bedriftsbrukeren din hos Contactor er endret til {newEmail}. Du logger inn med
                den nye adressen fra nå av, og lenker for å velge passord går dit.
            </p>

            <p>Var ikke dette deg? Ta kontakt med Contactor med en gang.</p>

            <p>
                Med vennlig hilsen<br/>
                Contactor
            </p>
        </Html>
    )
}
