import '@pn-server-only'
import { PAYMENT_HOURS_AFTER_PROMOTION } from './paymentDeadline'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import logger from '@/lib/logger'
import { escapeHtml } from '@/lib/html/escapeHtml'

/**
 * Tells the ones whose registrations were promoted from the waiting list of an event to one of its
 * places: users through the info channel of the event, guests by mail to the address they left,
 * if any. Call it only once the change that promoted them is saved.
 */
export async function notifyPromotedFromWaitingList(
    event: { id: number, name: string, infoNotificationChannelId: number },
    registrations: { userId: number | null, contact: { email: string | null } | null }[],
) {
    const title = 'Opprykk fra venteliste ved Omegas nettsider'
    const congratulation = 'Gratulerer! Du har rykket opp fra ventelisten på arrangementet'
    const paymentNote = `Hvis arrangementet krever betaling, har du minst ${PAYMENT_HOURS_AFTER_PROMOTION} timer `
        + 'på deg til å betale.'
    const message = `${congratulation} ${event.name}. ${paymentNote}`
    const mailBody = `${congratulation} ${escapeHtml(event.name)}. ${paymentNote}`

    const userIds = registrations.flatMap(registration => (
        registration.userId === null ? [] : [registration.userId]
    ))
    const guestEmails = registrations.flatMap(registration => (
        registration.contact?.email ? [registration.contact.email] : []
    ))

    if (userIds.length) {
        await eventNotificationOperations.internal.createInfoNotification.internalCall({
            params: { channelId: event.infoNotificationChannelId },
            data: {
                title,
                message,
                url: omegaEventLinks.event(event),
                audience: { userIds },
            },
        })
    }

    const sendings = await Promise.allSettled(guestEmails.map(email => (
        sendMailOperations.internal.sendSystemMail.internalCall({
            data: { to: email, subject: title, body: mailBody },
        })
    )))
    sendings.forEach((sending, index) => {
        if (sending.status === 'rejected') {
            const error: unknown = sending.reason
            logger.error(
                `Could not mail ${guestEmails[index]} about being promoted from the waiting list of ${event.name}`,
                { error },
            )
        }
    })
}
