import { linkToNotificationPage, replaceSpecialSymbols } from './helpers'
import { sendMailSchemas } from '@/services/notifications/sendMail/schemas'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import { DEFAULT_NOTIFICATION_ALIAS } from '@/lib/email/constants'
import { wrapInHTML } from '@/lib/email/wrapInHTML'
import logger from '@/lib/logger'
import type { NotificationWithChannel } from './types'
import type { UserBasicWithEmail } from '@/services/users/types'

/**
 * Sends a notification as one immediate email per recipient. The recipients are expected to be
 * already resolved (see recipientsWhere) - this only renders and sends.
 *
 * A recipient whose mail does not validate (e.g. a stored address that is not a valid email) is
 * logged and skipped. Throwing instead would stop the mail to everyone else, and the worker would
 * retry the notification forever as it never gets marked dispatched.
 *
 * @returns How many mails were sent.
 */
export async function sendNotificationEmails(
    senderAddress: string | null,
    notification: NotificationWithChannel,
    users: UserBasicWithEmail[]
) {
    const senderAlias = senderAddress ?? DEFAULT_NOTIFICATION_ALIAS

    const mails = (await Promise.all(users.map(async user => {
        const parsed = sendMailSchemas.data.notificationMail.safeParse({
            from: senderAlias,
            to: user.email,
            subject: replaceSpecialSymbols(notification.title, user),
            text: [
                replaceSpecialSymbols(notification.message, user),
                linkToNotificationPage(notification.url),
            ].filter(part => part !== null).join('\n\n'),
        })
        if (!parsed.success) {
            logger.warn(
                `Skipped user ${user.id} for notification ${notification.id}, the mail is invalid: ${parsed.error.message}`
            )
            return null
        }

        return {
            from: parsed.data.from,
            to: parsed.data.to,
            subject: parsed.data.subject,
            html: await wrapInHTML(user, parsed.data.text, notification.channel.name),
            list: {
                unsubscribe: {
                    url: `${process.env.WEBSITE_URL}/users/${user.username}/notifications`,
                    comment: 'Varslingsinnstillinger'
                },
            }
        }
    }))).filter(mail => mail !== null)

    if (mails.length > 0) {
        await sendMailOperations.internal.sendBulkMail.internalCall({ data: mails })
    }

    return mails.length
}
