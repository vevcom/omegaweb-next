import { sendMailSchemas } from '@/services/notifications/send-mail/schemas'
import { sendMailOperations } from '@/services/notifications/send-mail/operations'
import { replaceSpecialSymbols } from './helpers'
import { DEFAULT_NOTIFICATION_ALIAS } from '@/lib/email/constants'
import { wrapInHTML } from '@/lib/email/wrapInHTML'
import logger from '@/lib/logger'
import type { Notification } from '@/prisma-generated-pn-types'
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
    notification: Notification,
    users: UserBasicWithEmail[]
) {
    const senderAlias = senderAddress ?? DEFAULT_NOTIFICATION_ALIAS

    const mails = (await Promise.all(users.map(async user => {
        const parsed = sendMailSchemas.sendMail.safeParse({
            from: senderAlias,
            to: user.email,
            subject: replaceSpecialSymbols(notification.title, user),
            text: replaceSpecialSymbols(notification.message, user),
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
            html: await wrapInHTML(user, parsed.data.text),
            list: {
                unsubscribe: {
                    url: `${process.env.WEBSITE_URL}/users/${user.username}/unsubscribe`,
                    comment: 'Comment'
                },
            }
        }
    }))).filter(mail => mail !== null)

    if (mails.length > 0) {
        await sendMailOperations.internal.sendBulkMail.internalCall({ data: mails })
    }

    return mails.length
}
