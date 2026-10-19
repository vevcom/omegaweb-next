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

/** The error either operation gives up with when the other got to the booking first. */
function raceLost(message: string) {
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

    test('a payment attempt that a release got ahead of creates nothing', async () => {
        const booking = await createReservation(new Date('2030-02-10'))
        // createPayment looks up the cabin's account after reading the booking and before it
        // claims it, which gives the release a point to run at.
        const findAccount = prisma.ledgerAccount.findUnique.bind(prisma.ledgerAccount)
        jest.spyOn(prisma.ledgerAccount, 'findUnique').mockImplementationOnce((async (args: never) => {
            await releaseReservation(booking)
            return findAccount(args)
        }) as never)

        await expect(createPayment(booking)).rejects.toMatchObject(raceLost('i mellomtiden'))

        await expect(readBookingState(booking.id)).resolves.toEqual({ canceled: true, liveAttempts: 0 })
    })

    test('a release that a payment attempt got ahead of keeps the reservation', async () => {
        const booking = await createReservation(new Date('2030-03-10'))
        await createPayment(booking)
        const cancel = ledgerTransactionOperations.cancel
        jest.spyOn(ledgerTransactionOperations, 'cancel').mockImplementationOnce(async args => {
            const canceled = await cancel(args)
            await createPayment(booking)
            return canceled
        })

        await expect(releaseReservation(booking)).rejects.toMatchObject(raceLost('Prøv igjen'))

        await expect(readBookingState(booking.id)).resolves.toEqual({ canceled: false, liveAttempts: 1 })
    })

    test('a second payment attempt is refused while one is pending', async () => {
        const booking = await createReservation(new Date('2030-05-10'))
        await createPayment(booking)

        await expect(createPayment(booking)).rejects.toMatchObject(raceLost('allerede en betaling under behandling'))

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
