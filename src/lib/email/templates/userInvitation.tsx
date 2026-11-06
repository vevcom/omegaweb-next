import '@pn-server-only'

import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import { Html } from '@react-email/components'
import type { UserBasic } from '@/services/users/types'

export function UserInvitationTemplate({
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
                Vi har begynt å opprette en bruker til deg hos {domain}.
                Følg <a href={link}>denne lenken</a> for å fullføre registreringen.
                Har du problemer med å fullføre registreringen, kan du ta kontakt med VevCom på e-post:{' '}
                <a href={`mailto:vevcom@${domain}`}>vevcom@{domain}</a>.
            </p>

            <p>Hvis du ikke har registrert deg hos {domain}, kan du bare se bort fra denne e-posten.</p>

            <p>
                Med vennlig hilsen<br/>
                VevCom
            </p>
        </Html>
    )
}
