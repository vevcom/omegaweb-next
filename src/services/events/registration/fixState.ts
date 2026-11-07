import '@pn-server-only'
import { eventRegistrationQueueOrder } from './constants'
import { registrationsOfVariant } from './queue'
import { notifyPromotedFromWaitingList } from './notifyPromotedFromWaitingList'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { Smorekopp } from '@/services/error'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { eventQuotaOrder } from '@/services/events/constants'
import { membershipFilterSelection } from '@/services/groups/constants'
import { toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

export type PromotedRegistration = {
    id: number,
    userId: number | null,
    contact: { email: string | null } | null,
}

/**
 * Puts the registrations of a variant where they belong. A quota with more members than places
 * gives up its last ones, who queue again, though never one who has paid for the place: fewer
 * places than paid members is refused. Then each quota, in fill order, fills its free places
 * from the quotas after it, nearest first, and then from the waiting list, taking the first in
 * queue order who passes it. Someone taken off the waiting list loses their places on the waiting
 * lists of the other variants, unless the event allows registering for several.
 *
 * Run it under `lockEvent` after whatever changed the places or the registrations, and tell the
 * ones taken off the waiting list once the change is saved; see `notifyPromoted`.
 */
export async function fixVariantPlaces(tx: Prisma.TransactionClient, variantId: number): Promise<PromotedRegistration[]> {
    const variant = await tx.eventVariant.findUniqueOrThrow({
        where: { id: variantId },
        select: {
            eventId: true,
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

    const moves: { registration: Registration, quotaId: number }[] = []
    const promoted: Registration[] = []

    // Sequential by nature: a quota is filled from what the quotas before it left.
    quotas.forEach((quota, index) => {
        const passes = (registration: Registration) =>
            checkVisibility(registration.user?.memberships ?? [], quota.visibility)
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

    await Promise.all([
        ...moves.map(({ registration, quotaId }) => tx.eventRegistration.update({
            where: { id: registration.id },
            data: { state: 'IN_QUOTA', quotaId, waitingListVariantId: null },
        })),
        ...evicted.filter(registration => waiting.includes(registration)).map(registration => tx.eventRegistration.update({
            where: { id: registration.id },
            data: { state: 'WAITING_LIST', quotaId: null, waitingListVariantId: variantId },
        })),
    ])

    await leaveOtherWaitingLists(tx, { id: variantId, ...variant }, promoted.map(registration => registration.userId))

    return promoted.map(({ id, userId, contact }) => ({ id, userId, contact }))
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

/** Tells the ones `fixVariantPlaces` took off the waiting list, once the change is saved. */
export async function notifyPromoted(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number,
    promoted: PromotedRegistration[],
) {
    if (promoted.length === 0) return
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { id: true, name: true, infoNotificationChannelId: true },
    })
    await notifyPromotedFromWaitingList(event, promoted)
}
