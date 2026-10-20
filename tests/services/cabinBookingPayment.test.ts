import { prisma } from '@/prisma/client'
import { stripe } from '@/lib/stripe'
import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'

const dayMs = 24 * 60 * 60 * 1000

let paymentIntentCount = 0

/**
 * Replaces the Stripe calls a STRIPE payment attempt makes, so no test reaches Stripe. Each
 * intent gets its own id, since the id is unique across the stored payments.
 */
function mockStripe() {
    jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(() => {
        paymentIntentCount += 1
        return Promise.resolve({
            id: `pi_test_${paymentIntentCount}`,
            client_secret: `pi_test_${paymentIntentCount}_secret`,
        } as never)
    })
    jest.spyOn(stripe.paymentIntents, 'cancel').mockResolvedValue({} as never)
}

async function createReservation(start: Date) {
    return prisma.booking.create({
        data: {
            type: 'CABIN',
            start,
            end: new Date(start.getTime() + 2 * dayMs),
            numberOfMembers: 1,
            numberOfNonMembers: 0,
            totalPrice: 100_00,
            secret: `secret-${start.getTime()}`,
            transactionTimeout: new Date(Date.now() + 10 * 60 * 1000),
            guestUser: {
                create: {
                    firstname: 'Gjest',
                    lastname: 'Gjestesen',
                    email: 'gjest@example.com',
                    mobile: '12345678',
                },
            },
        },
    })
}

function createPayment(booking: { id: number, secret: string }) {
    return cabinBookingOperations.createPayment({
        params: { bookingId: booking.id, secret: booking.secret, provider: 'STRIPE' },
        bypassAuth: true,
    })
}

function releaseReservation(booking: { id: number, secret: string }) {
    return cabinBookingOperations.releaseReservation({
        params: { bookingId: booking.id, secret: booking.secret },
        bypassAuth: true,
    })
}

/** The error an operation is refused with. */
function refusal(message: string) {
    return { errorCode: 'BAD PARAMETERS', errors: [{ message: expect.stringContaining(message) }] }
}

async function readBookingState(bookingId: number) {
    const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: { ledgerTransactions: true },
    })
    return {
        canceled: booking.canceled !== null,
        liveAttempts: booking.ledgerTransactions.filter(
            transaction => transaction.state === 'PENDING' || transaction.state === 'SUCCEEDED'
        ).length,
    }
}

describe('cabin booking payment and release', () => {
    beforeAll(async () => {
        await prisma.ledgerAccount.create({ data: { type: 'GROUP', name: 'Hyttekonto', special: 'CABIN' } })
    })

    beforeEach(() => {
        mockStripe()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test('releasing a reservation cancels its pending payment attempt', async () => {
        const booking = await createReservation(new Date('2030-01-10'))
        await createPayment(booking)

        await releaseReservation(booking)

        await expect(readBookingState(booking.id)).resolves.toEqual({ canceled: true, liveAttempts: 0 })
    })

    test('a payment attempt after a release creates nothing', async () => {
        const booking = await createReservation(new Date('2030-02-10'))
        await releaseReservation(booking)

        await expect(createPayment(booking)).rejects.toMatchObject(refusal('kansellert'))

        await expect(readBookingState(booking.id)).resolves.toEqual({ canceled: true, liveAttempts: 0 })
    })

    test('a payment attempt and a release at the same time always end released', async () => {
        const booking = await createReservation(new Date('2030-03-10'))

        // Whichever locks the booking first, the release cancels the reservation and any attempt.
        const [, release] = await Promise.allSettled([createPayment(booking), releaseReservation(booking)])

        expect(release.status).toBe('fulfilled')
        await expect(readBookingState(booking.id)).resolves.toEqual({ canceled: true, liveAttempts: 0 })
    })

    test('a second payment attempt is refused while one is pending', async () => {
        const booking = await createReservation(new Date('2030-05-10'))
        await createPayment(booking)

        await expect(createPayment(booking)).rejects.toMatchObject(refusal('allerede en betaling under behandling'))

        await expect(readBookingState(booking.id)).resolves.toEqual({ canceled: false, liveAttempts: 1 })
    })

    test('a release that loses to a payment success leaves the booking', async () => {
        const booking = await createReservation(new Date('2030-06-10'))
        await createPayment(booking)
        // Stands in for advance() committing the success while the release cancels the attempt.
        jest.spyOn(stripe.paymentIntents, 'cancel').mockImplementation(async () => {
            await prisma.ledgerTransaction.updateMany({ where: { bookingId: booking.id }, data: { state: 'SUCCEEDED' } })
            return {} as never
        })

        await expect(releaseReservation(booking)).rejects.toMatchObject(refusal('ventende'))

        await expect(readBookingState(booking.id)).resolves.toEqual({ canceled: false, liveAttempts: 1 })
    })

    test('reading a transaction never exposes its booking\'s secret', async () => {
        const booking = await createReservation(new Date('2030-04-10'))
        await createPayment(booking)

        const transaction = await prisma.ledgerTransaction.findFirstOrThrow({ where: { bookingId: booking.id } })
        const read = await ledgerTransactionOperations.read({ params: { id: transaction.id }, bypassAuth: true })

        expect(read.booking).not.toHaveProperty('secret')
        expect(read.booking).not.toHaveProperty('notes')
        expect(read.booking).not.toHaveProperty('tenantNotes')
        expect(read.booking).toMatchObject({ numberOfMembers: 1, numberOfNonMembers: 0, totalPrice: 100_00 })
    })
})
