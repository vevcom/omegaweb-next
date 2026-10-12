import '@pn-server-only'

import { Html } from '@react-email/components'
import type { FeideIdentity } from '@/services/auth/types'
import type { UserBasic } from '@/services/users/types'

export function LinkFeideAccountTemplate({
    user,
    feideIdentity,
    link,
}: {
    user: UserBasic,
    feideIdentity: FeideIdentity,
    link: string,
}) {
    return (
        <Html>
            <h1>Koble Feide-innlogging til brukeren din</h1>

            <p>Hei {user.firstname},</p>

            <p>
                Feide-innloggingen til <strong>{feideIdentity.name} ({feideIdentity.email})</strong> har
                bedt om å bli koblet til brukeren din, {user.username}. Hvis du bekrefter, kan
                denne Feide-innloggingen logge inn som deg.
            </p>

            <p>
                <strong>Er ikke dette din Feide-innlogging, skal du ikke trykke på lenken.</strong>
            </p>

            <p>
                Er det deg, trykker du på denne <a href={link}>lenken</a> for å bekrefte koblingen.
                Lenken blir ugyldig etter 1 time.
            </p>

            <p>
                Med vennlig hilsen<br/>
                Vevcom
            </p>
        </Html>
    )
}
