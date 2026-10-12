import '@pn-server-only'

import { resetPasswordExpiration } from '@/lib/email/systemMail/constants'
import { Html } from '@react-email/components'
import type { UserBasic } from '@/services/users/types'

export function ResetPasswordTemplate({
    user,
    link,
}: {
    user: UserBasic,
    link: string,
}) {
    return (
        <Html>
            <h1>Glemt passord</h1>

            <p>Hei {user.firstname},</p>

            <p>
                Du får denne epsoten siden du har trykket på glemt passord.
                Trykk på denne <a href={link}>lenken</a> for å null stille passordet.
                Lenken blir ugyldig etter {resetPasswordExpiration / 60} minutter.
            </p>

            <p>Hvis du ikke har trykket på glemt passord knappen kan du bare se bort i fra denne e-posten.</p>

            <p>
                Med vennlig hilsen<br/>
                Vevcom
            </p>
        </Html>
    )
}
