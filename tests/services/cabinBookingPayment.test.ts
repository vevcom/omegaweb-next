import { prisma } from '@/prisma/client'
import { stripe } from '@/lib/stripe'
import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { stalePendingTransactionMs } from '@/services/ledger/transactions/constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { userOperations } from '@/services/users/operations'
import { afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'

const dayMs = 24 * 60 * 60 * 1000

let paymentIntentCount = 0

/**
 * Replaces the Stripe calls a STRIPE payment attempt makes, so no test reaches Stripe. Each
 * intent gets its own id, since the id is unique across the stored payments.
 */
function mockStripe() {
    jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(async () => {
        paymentIntentCount += 1
        return {
            id: `pi_test_${paymentIntentCount}`,
            client_secret: `pi_test_${paymentIntentCount}_secret`,
        } as never
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

/**
 * Starts an attempt on the booking and ages it past the stale limit. Both createPayment and
 * releaseReservation cancel such an attempt through ledgerTransactionOperations.cancel before
 * they touch the booking, which gives a test a point to run the racing operation at.
 */
async function createStaleAttempt(booking: { id: number, secret: string }) {
    await createPayment(booking)
    await prisma.ledgerTransaction.updateMany({
        where: { bookingId: booking.id },
        data: { createdAt: new Date(Date.now() - stalePendingTransactionMs - 1000) },
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
        const user = await userOperations.create({
            data: {
                email: 'hyttekonto@example.com',
                firstname: 'Hytte',
                lastname: 'Konto',
                username: 'hyttekonto',
            },
            bypassAuth: true,
        })
        const account = await ledgerAccountOperations.read({ params: { userId: user.id }, bypassAuth: true })
        await prisma.cabinSettings.create({ data: { ledgerAccountId: account.id } })
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
        await createStaleAttempt(booking)
        jest.spyOn(ledgerTransactionOperations, 'cancel').mockImplementationOnce(async () => {
            await releaseReservation(booking)
            return undefined as never
        })

        await expect(createPayment(booking)).rejects.toMatchObject(raceLost('i mellomtiden'))

        await expect(readBookingState(booking.id)).resolves.toEqual({ canceled: true, liveAttempts: 0 })
    })

    test('a release that a payment attempt got ahead of keeps the reservation', async () => {
        const booking = await createReservation(new Date('2030-03-10'))
        await createStaleAttempt(booking)
        jest.spyOn(ledgerTransactionOperations, 'cancel').mockImplementationOnce(async () => {
            await createPayment(booking)
            return undefined as never
        })

        await expect(releaseReservation(booking)).rejects.toMatchObject(raceLost('Prøv igjen'))

        await expect(readBookingState(booking.id)).resolves.toEqual({ canceled: false, liveAttempts: 1 })
    })
})
