import '@ow-server-only'
import { presentationSeatRefusal } from './constants'
import { lockEvent, seatedInEvent } from './queue'
import { linkedEventSeenBy } from '@/services/events/access'
import { Smorekopp } from '@/services/error'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Prisma } from '@/prisma-generated-pn-types'

/** The presentation registering for the event takes a seat on: the one it is linked to, when it says so. */
export async function requiredPresentationId(prisma: PrismaPossibleTransaction<false>, eventId: number) {
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { companyPresentationId: true, requiresPresentationSeat: true },
    })
    return event.requiresPresentationSeat ? event.companyPresentationId : null
}

/**
 * Those of the users who hold a seat on the presentation. It takes the presentation's `lockEvent`,
 * which every change to its seats takes, so a seat is not given up or lost before the transaction
 * ends. The caller holds the lock of the speed interview already, and the two are always taken in
 * that order: the speed interview's first, then its presentation's. Nothing that holds a
 * presentation's lock takes or writes its speed interview, which is why `destroy` lets go of the
 * link before it locks the presentation.
 */
export async function holdingSeatOn(
    tx: Prisma.TransactionClient,
    presentationId: number,
    userIds: number[],
): Promise<Set<number>> {
    if (userIds.length === 0) return new Set()
    await lockEvent(tx, presentationId)
    const seats = await tx.eventRegistration.findMany({
        where: { userId: { in: userIds }, ...seatedInEvent(presentationId) },
        select: { userId: true },
    })
    return new Set(seats.flatMap(seat => (seat.userId === null ? [] : [seat.userId])))
}

/**
 * Why the user may not register for the event for want of the seat it requires, in the words of
 * `presentationSeatRefusal`, or null when they hold it or it requires none. Under the locks of
 * both events, given `tx`, the seat stays as it is read.
 */
export async function seatRefusalOf(
    prisma: PrismaPossibleTransaction<false>,
    session: SessionMaybeUser,
    eventId: number,
    userId: number,
    tx?: Prisma.TransactionClient,
): Promise<string | null> {
    const presentationId = await requiredPresentationId(prisma, eventId)
    if (presentationId === null) return null
    const holds = tx
        ? (await holdingSeatOn(tx, presentationId, [userId])).has(userId)
        : await prisma.eventRegistration.count({ where: { userId, ...seatedInEvent(presentationId) } }) > 0
    return holds ? null : presentationSeatRefusal(await linkedEventSeenBy(prisma, session, presentationId))
}

/** Refuses a user who registers themselves without the seat on the presentation the event requires. */
export async function assertHoldsRequiredSeat(
    tx: Prisma.TransactionClient,
    session: SessionMaybeUser,
    eventId: number,
    userId: number,
) {
    const refusal = await seatRefusalOf(tx, session, eventId, userId, tx)
    if (refusal) throw new Smorekopp('BAD PARAMETERS', refusal)
}
