import '@pn-server-only'
import { fixVariantPlaces, notifyPromoted } from './fixState'
import { PAYMENT_HOURS_AFTER_PROMOTION } from './paymentDeadline'
import { lockEvent } from './queue'
import { eventSeatingOperations } from '@/services/events/seating/operations'
import { escapeHtml } from '@/lib/html/escapeHtml'
import logger from '@/lib/logger'
import { prisma } from '@/prisma-pn-client-instance'
import { validTransactionFilter } from '@/services/ledger/transactions/constants'
import { sendMailOperations } from '@/services/mail/send/operations'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Only matters while someone is waiting for the place. Guests are left out since they cannot pay
 * online. A PENDING transaction waits for the ledger sweeper, so a payment in progress is not
 * cancelled under the payer. Once the event has started the places are settled.
 */
function unpaidPastDeadline(now: Date): Prisma.EventRegistrationWhereInput {
    const promotionWindowStart = new Date(now.getTime() - PAYMENT_HOURS_AFTER_PROMOTION * 60 * 60 * 1000)
    return {
        state: 'IN_QUOTA',
        userId: { not: null },
        manuallyPaid: false,
        quota: {
            variant: {
                requeueUnpaidRegistrations: true,
                paymentEnd: { lt: now },
                event: { eventStart: { gt: now } },
                waitingListRegistrations: { some: {} },
            },
        },
        ledgerTransactions: { none: { OR: [{ state: 'PENDING' }, validTransactionFilter] } },
        // The time to pay after a promotion counts from when payment opens, as in paymentDeadline.
        OR: [
            { promotedAt: null },
            {
                promotedAt: { lt: promotionWindowStart },
                quota: { variant: { paymentStart: { lt: promotionWindowStart } } },
            },
        ],
    }
}

/** Rolls the move back when no one else in the queue can take the place. */
class SeatedAgain extends Error {}

/**
 * Sends the first registration whose time to pay has run out to the back of the waiting list and
 * gives its place on. Those who joined after the payment period never had a chance to pay, so they
 * are left to the administrators.
 */
export async function requeueNextUnpaidRegistration() {
    const now = new Date()
    const candidates = await prisma.eventRegistration.findMany({
        where: unpaidPastDeadline(now),
        orderBy: { id: 'asc' },
        select: {
            id: true,
            createdAt: true,
            promotedAt: true,
            user: { select: { email: true } },
            quota: {
                select: {
                    variantId: true,
                    variant: { select: { paymentEnd: true, event: { select: { id: true, name: true } } } },
                },
            },
        },
    })

    for (const candidate of candidates) {
        if (!candidate.quota) continue
        const { variantId, variant: { paymentEnd, event } } = candidate.quota
        // Prisma cannot compare createdAt with the variant's paymentEnd, so these few are fetched again each tick.
        if (candidate.promotedAt === null && paymentEnd && candidate.createdAt > paymentEnd) continue

        // One registration that keeps failing must not hold up the others.
        try {
            const promoted = await moveToBackOfQueue(candidate.id, event.id, variantId, now)
            if (!promoted) continue

            await notifyPromoted(prisma, event.id, promoted)
            if (candidate.user) await tellRequeued(candidate.id, candidate.user.email, event.name)
            return true
        } catch (error) {
            logger.error(`Could not requeue unpaid registration ${candidate.id} to the waiting list`, { error })
        }
    }
    return false
}

/** Returns who got a place from the move, or null if the registration stays where it is. */
async function moveToBackOfQueue(registrationId: number, eventId: number, variantId: number, now: Date) {
    try {
        return await prisma.$transaction(async tx => {
            await lockEvent(tx, eventId)
            // createPayment holds this row lock, not the event's, so it settles who got there first.
            await tx.$queryRaw`SELECT id FROM "EventRegistration" WHERE id = ${registrationId} FOR UPDATE`
            const stillUnpaid = await tx.eventRegistration.findFirst({
                where: { id: registrationId, ...unpaidPastDeadline(now) },
                select: { id: true },
            })
            if (!stillUnpaid) return null

            await eventSeatingOperations.internal.handOver.internalCall({ prisma: tx, params: { registrationId } })
            await tx.eventRegistration.update({
                where: { id: registrationId },
                data: {
                    state: 'WAITING_LIST',
                    quotaId: null,
                    waitingListVariantId: variantId,
                    queuedAt: new Date(),
                    promotedAt: null,
                },
            })
            const promoted = await fixVariantPlaces(tx, variantId)
            if (promoted.length === 0 || promoted.some(registration => registration.id === registrationId)) {
                throw new SeatedAgain()
            }
            return promoted
        })
    } catch (error) {
        if (error instanceof SeatedAgain) return null
        throw error
    }
}

async function tellRequeued(registrationId: number, email: string, eventName: string) {
    try {
        await sendMailOperations.sendSystemMail.internalCall({
            data: {
                to: email,
                subject: 'Du er flyttet til ventelisten ved Omegas nettsider',
                body: `Du er flyttet bakerst på ventelisten til ${escapeHtml(eventName)} `
                    + 'fordi plassen ikke ble betalt innen fristen.',
            },
        })
    } catch (error) {
        logger.error(
            `Could not mail registration ${registrationId} about being moved to the waiting list of ${eventName}`,
            { error },
        )
    }
}
