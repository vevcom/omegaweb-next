import '@pn-server-only'
import { notificationOperations } from '@/services/notifications/operations'
import { sendMailOperations } from '@/services/notifications/send-mail/operations'
import logger from '@/lib/logger'

/**
 * Tells the ones whose registrations were promoted from the waiting list of an event to one of its
 * places: users through the notification channel for it, guests by mail to the address they left,
 * if any. Call it only once the change that promoted them is saved.
 */
export async function notifyPromotedFromWaitingList(
    eventName: string,
    registrations: { userId: number | null, contact: { email: string | null } | null }[],
) {
    const title = 'Opprykk fra venteliste ved Omegas nettsider'
    const message = `Gratulerer! Du har rykket opp fra venteliste på arrangementet ${eventName}.`

    const userIds = registrations.flatMap(registration => (
        registration.userId === null ? [] : [registration.userId]
    ))
    const guestEmails = registrations.flatMap(registration => (
        registration.contact?.email ? [registration.contact.email] : []
    ))

    if (userIds.length) {
        await notificationOperations.createSpecial.internalCall({
            params: {
                special: 'EVENT_WAITINGLIST_PROMOTION',
            },
            data: {
                title,
                message,
                audience: { userIds },
            },
        })
    }

    const sendings = await Promise.allSettled(guestEmails.map(email => (
        sendMailOperations.internal.sendSystemMail.internalCall({
            data: { to: email, subject: title, body: message },
        })
    )))
    sendings.forEach((sending, index) => {
        if (sending.status === 'rejected') {
            logger.error(
                `Could not mail ${guestEmails[index]} about being promoted from the waiting list of ${eventName}`,
                { error: sending.reason },
            )
        }
    })
}
