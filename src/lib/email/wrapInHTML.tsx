import '@pn-server-only'
import { DefaultEmailTemplate } from './templates/default'
import { markdownToSafeHtml } from '@/lib/html/safeHtml'
import { render } from '@react-email/render'
import type { UserBasic } from '@/services/users/types'

/**
 * Renders a notification's markdown as a mail for the user, with the footer of the default template.
 *
 * @param channelName - The channel the notification was sent on, named in the footer. Left out for
 * the weekly digest, which gathers several channels.
 */
export async function wrapInHTML(user: UserBasic, text: string, channelName?: string): Promise<string> {
    return render(
        <DefaultEmailTemplate user={user} html={await markdownToSafeHtml(text, { gfm: true })} channelName={channelName} />
    )
}
