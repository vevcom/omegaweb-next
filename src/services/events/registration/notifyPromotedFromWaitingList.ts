import '@ow-server-only'
import { PAYMENT_HOURS_AFTER_PROMOTION } from './paymentDeadline'
import { tellRegistrants } from './tellRegistrants'
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
    const congratulation = 'Gratulerer! Du har rykket opp fra ventelisten på arrangementet'
    const paymentNote = `Hvis arrangementet krever betaling, har du minst ${PAYMENT_HOURS_AFTER_PROMOTION} timer `
        + 'på deg til å betale.'
    const slotNote = (slot: Slot | null) => (slot ? ` Du har fått tidsluken ${displaySlot(slot)}.` : '')

    await tellRegistrants(event, 'Opprykk fra venteliste ved Omegas nettsider', registrations.map(
        ({ userId, contact, slot }) => ({
            userId,
            contact,
            message: `${congratulation} ${event.name}.${slotNote(slot)} ${paymentNote}`,
            mailBody: `${congratulation} ${escapeHtml(event.name)}.${slotNote(slot)} ${paymentNote}`,
        })
    ))
}
