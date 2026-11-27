import '@ow-server-only'
import { PAYMENT_HOURS_AFTER_PROMOTION } from './paymentDeadline'
import { eventNotificationOperations } from '@/services/events/notifications/operations'
import { eventHomeLinks } from '@/pageKits/events/links'
import { sendMailOperations } from '@/services/mail/send/operations'
import logger from '@/lib/logger'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { displaySlot } from '@/services/events/slots/display'
import type { Slot } from '@/services/events/slots/types'
import type { EventKind } from '@/prisma-generated-pn-types'

/**
 * Tells the ones whose registrations were promoted from the waiting list of an event to one of its
 * places, and the slot they got on a slotted variant: users through the info channel of the event,
 * guests by mail to the address they left, if any. Call it only once the change that promoted them
 * is saved.
 */
export async function notifyPromotedFromWaitingList(
    event: { id: number, kind: EventKind, name: string, infoNotificationChannelId: number },
    registrations: { userId: number | null, contact: { email: string | null } | null, slot: Slot | null }[],
) {
    const title = 'Opprykk fra venteliste ved Omegas nettsider'
    const congratulation = 'Gratulerer! Du har rykket opp fra ventelisten på arrangementet'
    const paymentNote = `Hvis arrangementet krever betaling, har du minst ${PAYMENT_HOURS_AFTER_PROMOTION} timer `
        + 'på deg til å betale.'
    const slotNote = (slot: Slot | null) => (slot ? ` Du har fått tidsluken ${displaySlot(slot)}.` : '')
    const message = (slot: Slot | null) => `${congratulation} ${event.name}.${slotNote(slot)} ${paymentNote}`
    const mailBody = (slot: Slot | null) => `${congratulation} ${escapeHtml(event.name)}.${slotNote(slot)} ${paymentNote}`

    // Each is told of their own slot, and those given none are told in one notification, as before.
    const usersByMessage = new Map<string, number[]>()
    for (const { userId, slot } of registrations) {
        if (userId === null) continue
        usersByMessage.set(message(slot), [...usersByMessage.get(message(slot)) ?? [], userId])
    }
    const guests = registrations.flatMap(({ contact, slot }) => (
        contact?.email ? [{ email: contact.email, slot }] : []
    ))

    for (const [text, userIds] of Array.from(usersByMessage)) {
        await eventNotificationOperations.internal.createInfoNotification.internalCall({
            params: { channelId: event.infoNotificationChannelId },
            data: {
                title,
                message: text,
                url: eventHomeLinks(event).event(event),
                audience: { userIds },
            },
        })
    }

    const sendings = await Promise.allSettled(guests.map(({ email, slot }) => (
        sendMailOperations.sendSystemMail.internalCall({
            data: { to: email, subject: title, body: mailBody(slot) },
        })
    )))
    sendings.forEach((sending, index) => {
        if (sending.status === 'rejected') {
            const error: unknown = sending.reason
            logger.error(
                `Could not mail ${guests[index].email} about being promoted from the waiting list of ${event.name}`,
                { error },
            )
        }
    })
}
