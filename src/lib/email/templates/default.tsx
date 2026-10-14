import '@pn-server-only'

import { Html } from '@react-email/components'
import type { UserBasic } from '@/services/users/types'

/**
 * Wraps a notification for sending by mail. The footer says why the user gets it: they subscribe
 * to the channel it was sent on, which they change on their notification settings page. System
 * mails (password reset, email verification, ...) have templates of their own: they follow from
 * something the user did and cannot be unsubscribed from.
 */
export function DefaultEmailTemplate({
    user,
    html,
    channelName,
}: {
    user: UserBasic,
    html: string,
    channelName?: string,
}) {
    const settingsUrl = `${process.env.WEBSITE_URL}/users/${user.username}/notifications`
    return (
        <Html>
            <div dangerouslySetInnerHTML={{ __html: html }} />

            <p style={{ color: '#666' }}>
                {channelName
                    ? <>Du får denne e-posten fordi du abonnerer på varslingskanalen «{channelName}».</>
                    : <>Du får denne e-posten fordi du abonnerer på varslinger fra Sct. Omega Broderskab.</>}
                {' '}Du kan endre hvilke varsler du får på e-post i <a href={settingsUrl}>varslingsinnstillingene dine</a>.
            </p>
        </Html>
    )
}
