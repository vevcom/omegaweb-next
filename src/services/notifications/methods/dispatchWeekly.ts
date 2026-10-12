import { sendMailSchemas } from '@/services/notifications/send-mail/schemas'
import { sendMailOperations } from '@/services/notifications/send-mail/operations'
import { replaceSpecialSymbols } from './helpers'
import { weeklyDigest } from './constants'
import { DEFAULT_NOTIFICATION_ALIAS } from '@/lib/email/constants'
import { wrapInHTML } from '@/lib/email/wrapInHTML'
import logger from '@/lib/logger'
import type { WeeklyDigestNotification } from './types'
import type { UserBasicWithEmail } from '@/services/users/types'

/**
 * Builds the markdown body of one user's weekly digest. The default email template renders the
 * text as markdown, so each notification becomes its own section.
 */
export function buildWeeklyDigestText(user: UserBasicWithEmail, notifications: WeeklyDigestNotification[]) {
    return notifications.map(notification => [
        `## ${replaceSpecialSymbols(notification.title, user)}`,
        `*${notification.channel.name}*`,
        replaceSpecialSymbols(notification.message, user),
    ].join('\n')).join('\n\n')
}

/**
 * Sends one user their weekly digest mail containing the given notifications. The digest spans
 * channels, so it is always sent from the default notification alias rather than a channel's own.
 *
 * A digest that does not validate (e.g. a stored address that is not a valid email) is logged and
 * skipped rather than thrown: it would fail the same way on every retry, so its outbox rows must
 * be let go.
 *
 * @returns Whether the digest was sent.
 */
export async function sendWeeklyEmailDigest(user: UserBasicWithEmail, notifications: WeeklyDigestNotification[]) {
    const parsed = sendMailSchemas.sendMail.safeParse({
        from: DEFAULT_NOTIFICATION_ALIAS,
        to: user.email,
        subject: weeklyDigest.subject,
        text: buildWeeklyDigestText(user, notifications),
    })
    if (!parsed.success) {
        logger.warn(`Skipped the weekly digest of user ${user.id}, the mail is invalid: ${parsed.error.message}`)
        return false
    }

    await sendMailOperations.internal.sendBulkMail.internalCall({
        data: [{
            from: parsed.data.from,
            to: parsed.data.to,
            subject: parsed.data.subject,
            html: await wrapInHTML(user, parsed.data.text),
            list: {
                unsubscribe: {
                    url: `${process.env.WEBSITE_URL}/users/${user.username}/unsubscribe`,
                    comment: 'Comment'
                },
            },
        }],
    })

    return true
}
