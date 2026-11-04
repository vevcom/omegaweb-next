import '@pn-server-only'

import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import { Html } from '@react-email/components'
import type { UserBasic } from '@/services/users/types'

export function VerifyEmailTemplate({
    user,
    link,
}: {
    user: UserBasic,
    link: string,
}) {
    const domain = DomainContext.mailDomainOf(Site.root)
    return (
        <Html>
            <p>Hei {user.firstname},</p>

            <p>
                Du får denne e-posten fordi du nettopp registrerte deg hos {domain}.
                Bekreft e-posten din ved å trykke på <a href={link}>lenken</a>.
            </p>

            <p>Hvis du ikke har registrert deg hos {domain}, kan du bare se bort fra denne e-posten.</p>

            <p>
                Med vennlig hilsen<br/>
                VevCom
            </p>
        </Html>
    )
}
