import '@pn-server-only'

import { Html } from '@react-email/components'
import type { UserBasic } from '@/services/users/types'

export function UserInvitationTemplate({
    user,
    link,
}: {
    user: UserBasic,
    link: string,
}) {
    return (
        <Html>
            <p>Hei {user.firstname},</p>

            <p>
                Vi har begynt å opprette en bruker til deg hos {process.env.WEBSITE_DOMAIN}.
                Følg <a href={link}>denne lenken</a> for å fullføre registreringen.
                Har du problemer med å fullføre registreringen, kan du ta kontakt med VevCom på e-post:{' '}
                <a href={`mailto:vevcom@${process.env.EMAIL_DOMAIN}`}>vevcom@{process.env.EMAIL_DOMAIN}</a>.
            </p>

            <p>Hvis du ikke har registrert deg hos {process.env.WEBSITE_DOMAIN}, kan du bare se bort fra denne e-posten.</p>

            <p>
                Med vennlig hilsen<br/>
                VevCom
            </p>
        </Html>
    )
}
