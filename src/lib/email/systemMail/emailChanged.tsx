import '@pn-server-only'
import { EmailChangedTemplate } from '@/lib/email/templates/emailChanged'
import { sendMailOperations } from '@/services/notifications/send-mail/operations'
import logger from '@/lib/logger'
import type { UserBasicWithEmail } from '@/services/users/types'

/**
 * Tells the old address that the email of a user was changed. A failure is only logged: the change
 * itself has already happened.
 */
export async function sendEmailChangedMail(user: UserBasicWithEmail, oldEmail: string) {
    if (oldEmail === user.email) return

    try {
        await sendMailOperations.internal.sendSystemMail.internalCall({
            data: {
                to: oldEmail,
                subject: 'E-posten din er endret',
                body: <EmailChangedTemplate user={user} newEmail={user.email} />,
            },
        })
    } catch (error) {
        logger.error(`Failed to tell the old email of user '${user.username}' about the change`, { error })
    }
}
