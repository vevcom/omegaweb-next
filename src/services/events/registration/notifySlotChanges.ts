import '@ow-server-only'
import { tellRegistrants } from './tellRegistrants'
import { escapeHtml } from '@/lib/html/escapeHtml'
import { displaySlot } from '@/services/events/slots/display'
import logger from '@/lib/logger'
import type { SlotChange } from '@/services/events/slots/types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

/** Whether a change is one to tell the registrant of: a removal, or a slot that is not the same as before. */
export function isToldOf(change: SlotChange) {
    if (change.removed || !change.before || !change.after) return true
    return change.before.start.getTime() !== change.after.start.getTime()
        || change.before.end.getTime() !== change.after.end.getTime()
}

/**
 * Tells those whose slot an administrator changed of it, each once, in the info channel of the event
 * as a change of it, or by mail to a guest who left an address: the slot they hold now in Oslo time,
 * that they wait for one, or that they are removed, naming the variant when the event has several.
 * `alsoChanged` is what the save says of the event besides, for those who are told of it here and
 * not by the notice to everyone registered. Call it only once the change is saved: it logs what
 * fails and throws nothing, so a failed notice does not fail what is saved.
 */
export async function notifySlotChanges(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number,
    changes: SlotChange[],
    alsoChanged: string | null = null,
) {
    const told = changes.filter(isToldOf)
    if (told.length === 0) return
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
            id: true,
            kind: true,
            name: true,
            infoNotificationChannelId: true,
            variants: { select: { id: true, name: true } },
        },
    }).catch((error: unknown) => {
        logger.error(`Could not read event ${eventId} to tell of slot changes`, { error })
        return null
    })
    if (!event) return
    const placeOf = (change: SlotChange) => {
        const variant = event.variants.length > 1 && event.variants.find(({ id }) => id === change.variantId)
        return variant ? `${event.name}, ${variant.name}` : event.name
    }
    const what = (change: SlotChange, place: string) => {
        if (change.removed) return `Du er meldt av ${place}, siden timeplanen er endret.`
        if (!change.after) return `Du har ikke lenger en tidsluke på ${place}, og står på ventelisten.`
        return `Du har nå tidsluken ${displaySlot(change.after)} på ${place}.`
    }
    const joined = (...parts: (string | null)[]) => parts.filter(Boolean).join(' ')

    // One whose slots change in several variants is told once, of each: a user by their id, and a
    // guest by the address they left.
    const byRegistrant = new Map<string, SlotChange[]>()
    for (const change of told) {
        const key = change.userId !== null
            ? `user ${change.userId}`
            : `guest ${change.contact?.email ?? `#${change.registrationId}`}`
        byRegistrant.set(key, [...byRegistrant.get(key) ?? [], change])
    }
    await tellRegistrants(event, `Endring i ${event.name}`, Array.from(byRegistrant.values()).map(ofRegistrant => ({
        userId: ofRegistrant[0].userId,
        contact: ofRegistrant[0].contact,
        message: joined(alsoChanged, ...ofRegistrant.map(change => what(change, placeOf(change)))),
        mailBody: joined(
            alsoChanged && escapeHtml(alsoChanged),
            ...ofRegistrant.map(change => what(change, escapeHtml(placeOf(change)))),
        ),
    })))
}
