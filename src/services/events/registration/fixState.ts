import '@ow-server-only'
import { eventRegistrationQueueOrder } from './constants'
import { registrationsOfVariant } from './queue'
import { notifyPromotedFromWaitingList } from './notifyPromotedFromWaitingList'
import { holdingSeatOn, requiredPresentationId } from './presentationSeat'
import { eventSeatingOperations } from '@/services/events/seating/operations'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { Smorekopp } from '@/services/error'
import logger from '@/lib/logger'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { eventQuotaOrder } from '@/services/events/constants'
import { membershipFilterSelection } from '@/services/groups/constants'
import { toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Slot } from '@/services/events/slots/types'

export type PromotedRegistration = {
    id: number,
    userId: number | null,
    contact: { email: string | null } | null,
    slot: Slot | null,
}

/** What a change to the registrations of a variant tells the pass that puts them in place. */
export type PlaceChange = {
    /**
     * A registration only just made, so seating it is an ordinary sign-up and not a promotion. On
     * a slotted variant it holds the slot it picked once seated, or none, which its maker refuses.
     */
    joining?: { id: number, slotId: number | null },
    /** A slot the change gave up, which the first one seated gets before any other free slot. */
    freedSlotId?: number | null,
}

/**
 * Puts the registrations of a variant where they belong. A quota with more members than places
 * gives up its last ones, who queue again, though never one who has paid for the place: fewer
 * places than paid members is refused. Then each quota, in fill order, fills its free places
 * from the quotas after it, nearest first, and then from the waiting list, taking the first in
 * queue order who passes it. Someone taken off the waiting list loses their places on the waiting
 * lists of the other variants, unless the event allows registering for several. When the event
 * requires a seat on a presentation, only one holding it is taken off the waiting list, so one
 * who has lost it since they queued waits on.
 *
 * On a slotted variant everyone with a place holds a slot of their own, and no one waiting holds
 * one: whoever goes back to the waiting list gives their slot up, and whoever is seated without
 * one is given a free slot, see `slotsForSeated`. The places of a slotted variant are as many as
 * its slots, so there is a free slot for each free place.
 *
 * Run it under `lockEvent` after whatever changed the places or the registrations, and tell the
 * ones taken off the waiting list once the change is saved; see `notifyPromoted`.
 */
export async function fixVariantPlaces(
    tx: Prisma.TransactionClient,
    variantId: number,
    change: PlaceChange = {},
): Promise<PromotedRegistration[]> {
    const variant = await tx.eventVariant.findUniqueOrThrow({
        where: { id: variantId },
        select: {
            eventId: true,
            registrationType: true,
            event: { select: { allowRegistrationInMultipleVariants: true } },
            quotas: {
                orderBy: eventQuotaOrder,
                select: { id: true, places: true, visibility: { include: visibilityIncluder } },
            },
        },
    })
    const registrations = await tx.eventRegistration.findMany({
        where: registrationsOfVariant(variantId),
        orderBy: eventRegistrationQueueOrder,
        select: {
            id: true,
            userId: true,
            quotaId: true,
            state: true,
            slotId: true,
            queuedAt: true,
            manuallyPaid: true,
            ledgerTransactions: { where: validTransactionFilter, select: { id: true }, take: 1 },
            contact: { select: { email: true } },
            user: { select: { memberships: { select: membershipFilterSelection } } },
        },
    })
    type Registration = typeof registrations[number]

    const quotas = variant.quotas.map(quota => ({
        id: quota.id,
        places: quota.places,
        visibility: toMatrix(quota.visibility),
        members: registrations.filter(registration => registration.quotaId === quota.id),
    }))
    const waiting = registrations.filter(registration => registration.state === 'WAITING_LIST')
    const presentationId = await requiredPresentationId(tx, variant.eventId)
    const seatHolders = presentationId === null ? null : await holdingSeatOn(
        tx,
        presentationId,
        waiting.flatMap(registration => (registration.userId === null ? [] : [registration.userId])),
    )
    // One with a place keeps it, and a guest, who can hold no seat, is not held to it. A seat got
    // back on the presentation while waiting counts from the next change here, since a change to
    // the presentation fixes no places of its speed interview.
    const maySeat = (registration: Registration) => seatHolders === null || registration.state === 'IN_QUOTA'
        || registration.userId === null || seatHolders.has(registration.userId)
    const hasPaid = (registration: Registration) =>
        registration.manuallyPaid || registration.ledgerTransactions.length > 0
    const evicted = quotas.flatMap(quota => {
        const over = quota.members.length - quota.places
        if (over <= 0) return []
        const leaving = quota.members.filter(member => !hasPaid(member)).slice(-over)
        if (leaving.length < over) {
            throw new Smorekopp(
                'BAD PARAMETERS',
                'Flere har betalt for plassen sin i kvoten enn plassene den får. Flytt eller meld av noen av dem først.'
            )
        }
        quota.members = quota.members.filter(member => !leaving.includes(member))
        return leaving
    })
    waiting.push(...evicted)
    waiting.sort((first, second) => first.queuedAt.getTime() - second.queuedAt.getTime() || first.id - second.id)

    const now = new Date()
    const moves: { registration: Registration, quotaId: number }[] = []
    const promoted: Registration[] = []

    // Sequential by nature: a quota is filled from what the quotas before it left.
    quotas.forEach((quota, index) => {
        const passes = (registration: Registration) => maySeat(registration)
            && checkVisibility(registration.user?.memberships ?? [], quota.visibility)
        while (quota.members.length < quota.places) {
            const pools = [...quotas.slice(index + 1).map(lower => lower.members), waiting]
            const pool = pools.find(candidates => candidates.some(passes))
            const candidate = pool?.find(passes)
            if (!pool || !candidate) break

            pool.splice(pool.indexOf(candidate), 1)
            quota.members.push(candidate)
            moves.push({ registration: candidate, quotaId: quota.id })
            if (candidate.state === 'WAITING_LIST') promoted.push(candidate)
            candidate.state = 'IN_QUOTA'
            candidate.quotaId = quota.id
        }
    })

    const requeued = evicted.filter(registration => waiting.includes(registration))
    for (const registration of requeued) {
        await eventSeatingOperations.internal.handOver.internalCall({
            prisma: tx,
            params: { registrationId: registration.id },
        })
    }

    const joiningId = change.joining?.id
    await Promise.all([
        ...moves.map(({ registration, quotaId }) => tx.eventRegistration.update({
            where: { id: registration.id },
            data: {
                state: 'IN_QUOTA',
                quotaId,
                waitingListVariantId: null,
                promotedAt: promoted.includes(registration) && registration.id !== joiningId ? now : undefined,
            },
        })),
        ...requeued.map(registration => tx.eventRegistration.update({
            where: { id: registration.id },
            data: {
                state: 'WAITING_LIST',
                quotaId: null,
                waitingListVariantId: variantId,
                promotedAt: null,
                slotId: null,
            },
        })),
    ])

    const slots = variant.registrationType === 'SLOTTED'
        ? await tx.eventSlot.findMany({
            where: { variantId },
            orderBy: { start: 'asc' },
            select: { id: true, start: true, end: true },
        })
        : []
    const slotsGiven = variant.registrationType === 'SLOTTED'
        ? slotsForSeated(slots, quotas.flatMap(quota => quota.members), {
            joining: change.joining,
            freedSlotIds: [change.freedSlotId ?? null, ...requeued.map(registration => registration.slotId)],
        })
        : new Map<number, number>()
    await Promise.all(Array.from(slotsGiven).map(([registrationId, slotId]) => tx.eventRegistration.update({
        where: { id: registrationId },
        data: { slotId },
    })))

    await leaveOtherWaitingLists(tx, { id: variantId, ...variant }, promoted.map(registration => registration.userId))

    const slotOf = (registrationId: number) => {
        const slot = slots.find(candidate => candidate.id === slotsGiven.get(registrationId))
        return slot ? { start: slot.start, end: slot.end } : null
    }
    return promoted.flatMap(({ id, userId, contact }) => (
        id === joiningId ? [] : [{ id, userId, contact, slot: slotOf(id) }]
    ))
}

/**
 * The slots of those seated who hold none yet: the joining one the slot it picked, and each of the
 * others a free one, the slots freed by the change first and then the earliest.
 */
function slotsForSeated(
    slots: { id: number }[],
    seated: { id: number, slotId: number | null }[],
    { joining, freedSlotIds }: { joining?: PlaceChange['joining'], freedSlotIds: (number | null)[] },
): Map<number, number> {
    const given = new Map<number, number>()
    const unslotted = seated.filter(registration => registration.slotId === null)
    const joiningSeated = unslotted.find(registration => registration.id === joining?.id)
    const joiningSlotId = joining?.slotId ?? null
    if (joiningSeated && joiningSlotId !== null) given.set(joiningSeated.id, joiningSlotId)
    const held = new Set([
        ...seated.flatMap(registration => (registration.slotId === null ? [] : [registration.slotId])),
        ...Array.from(given.values()),
    ])
    const free = [
        ...slots.filter(slot => freedSlotIds.includes(slot.id)),
        ...slots.filter(slot => !freedSlotIds.includes(slot.id)),
    ].filter(slot => !held.has(slot.id))

    for (const registration of unslotted) {
        if (registration.id === joining?.id) continue
        const slot = free.shift()
        if (!slot) {
            throw new Smorekopp('SERVER ERROR', 'Varianten har flere plasser enn ledige tidsluker.')
        }
        given.set(registration.id, slot.id)
    }
    return given
}

/**
 * Takes the users off the waiting lists of the event's other variants once they hold a place in
 * this one, unless the event allows registering for several. For whoever seats them: the
 * place-fixing pass, and administrators seating someone directly.
 */
export async function leaveOtherWaitingLists(
    tx: Prisma.TransactionClient,
    variant: { id: number, eventId: number, event: { allowRegistrationInMultipleVariants: boolean } },
    userIds: (number | null)[],
) {
    const seated = userIds.flatMap(userId => (userId === null ? [] : [userId]))
    if (seated.length === 0 || variant.event.allowRegistrationInMultipleVariants) return
    await tx.eventRegistration.deleteMany({
        where: {
            userId: { in: seated },
            waitingListVariant: { eventId: variant.eventId, id: { not: variant.id } },
        },
    })
}

/**
 * Tells the ones `fixVariantPlaces` took off the waiting list, once the change is saved. It logs what
 * fails and throws nothing, as `notifySlotChanges` does.
 */
export async function notifyPromoted(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number,
    promoted: PromotedRegistration[],
) {
    if (promoted.length === 0) return
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, kind: true, name: true, infoNotificationChannelId: true },
    }).catch((error: unknown) => {
        logger.error(`Could not read event ${eventId} to tell of promotions`, { error })
        return null
    })
    if (!event) return
    await notifyPromotedFromWaitingList(event, promoted)
}
