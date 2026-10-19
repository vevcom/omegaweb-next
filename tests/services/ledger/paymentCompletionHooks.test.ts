import { prisma } from '@/prisma/client'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { runNextPaymentCompletionHook } from '@/services/ledger/transactions/paymentCompletionHooks'
import { userOperations } from '@/services/users/operations'
import { recordSentMail } from 'tests/utils'
import { beforeEach, describe, expect, test } from '@jest/globals'

const PRICE = 50_00
const dayMs = 24 * 60 * 60 * 1000

async function createAccount(username: string) {
    const user = await userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
    return ledgerAccountOperations.read({ params: { userId: user.id }, bypassAuth: true })
}

/** A SUCCEEDED manual deposit, which gives the account a balance to pay with. */
async function createSucceededDeposit(ledgerAccountId: number) {
    const payment = await paymentOperations.create({
        params: { provider: 'MANUAL', funds: PRICE, manualFees: 0 },
        bypassAuth: true,
    })
    return ledgerTransactionOperations.create({
        params: { purpose: 'DEPOSIT', ledgerEntries: [{ ledgerAccountId, funds: PRICE }], paymentId: payment.id },
        bypassAuth: true,
    })
}

/** A guest's reservation, still holding its dates until it is paid for. */
function createReservation(start: Date) {
    return prisma.booking.create({
        data: {
            type: 'CABIN',
            start,
            end: new Date(start.getTime() + 2 * dayMs),
            numberOfMembers: 1,
            numberOfNonMembers: 0,
            totalPrice: PRICE,
            secret: `secret-${start.getTime()}`,
            transactionTimeout: new Date(Date.now() + 10 * 60 * 1000),
            guestUser: {
                create: { firstname: 'Gjest', lastname: 'Gjestesen', email: 'gjest@example.com', mobile: '12345678' },
            },
        },
    })
}

/** Pays for the booking from a fresh account's balance, so the transaction succeeds at once. */
async function payForBooking(bookingId: number, username: string) {
    const payer = await createAccount(username)
    const cabin = await prisma.ledgerAccount.create({ data: { type: 'GROUP', name: `Hytte ${username}` } })
    await createSucceededDeposit(payer.id)
    return ledgerTransactionOperations.create({
        params: {
            purpose: 'CABIN_BOOKING',
            ledgerEntries: [
                { ledgerAccountId: cabin.id, funds: PRICE },
                { ledgerAccountId: payer.id, funds: -PRICE },
            ],
            bookingId,
        },
        bypassAuth: true,
    })
}

/** When the transaction's completion hook was requested and when it ran, if ever. */
const completionOf = (transactionId: number) => prisma.ledgerTransaction.findUniqueOrThrow({
    where: { id: transactionId },
    select: { completionHookRequestedAt: true, completionHookRanAt: true },
})

let sentMail: ReturnType<typeof recordSentMail>

beforeEach(async () => {
    sentMail = recordSentMail()
    // Each test starts with an empty queue, whatever the ones before it left behind.
    await prisma.ledgerTransaction.updateMany({
        where: { completionHookRequestedAt: { not: null }, completionHookRanAt: null },
        data: { completionHookRanAt: new Date() },
    })
})

describe('payment completion', () => {
    test('a succeeded cabin booking waits for the worker, and a deposit does not', async () => {
        const booking = await createReservation(new Date('2031-01-10'))
        const transaction = await payForBooking(booking.id, 'completionwaits')
        const deposit = await createSucceededDeposit((await createAccount('completiondeposit')).id)

        expect(transaction.state).toBe('SUCCEEDED')
        expect(await completionOf(transaction.id))
            .toEqual({ completionHookRequestedAt: expect.any(Date), completionHookRanAt: null })
        expect(await completionOf(deposit.id)).toEqual({ completionHookRequestedAt: null, completionHookRanAt: null })
        // Nothing is confirmed until the worker gets to it.
        expect(sentMail).not.toHaveBeenCalled()
    })

    test('the worker confirms the booking once and sends one confirmation', async () => {
        const booking = await createReservation(new Date('2031-02-10'))
        const transaction = await payForBooking(booking.id, 'completionruns')

        expect(await runNextPaymentCompletionHook()).toBe(true)
        expect(await runNextPaymentCompletionHook()).toBe(false)

        const { completionHookRequestedAt, completionHookRanAt } = await completionOf(transaction.id)
        expect(completionHookRanAt!.getTime()).toBeGreaterThanOrEqual(completionHookRequestedAt!.getTime())
        expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
            .toMatchObject({ transactionTimeout: null, canceled: null })
        expect(sentMail).toHaveBeenCalledTimes(1)
    })

    test('a failing hook is rolled back, flagged once and not retried', async () => {
        const booking = await createReservation(new Date('2031-03-10'))
        const transaction = await payForBooking(booking.id, 'completionfails')
        sentMail.mockRejectedValueOnce(new Error('SMTP is down'))

        expect(await runNextPaymentCompletionHook()).toBe(true)
        expect(await runNextPaymentCompletionHook()).toBe(false)

        // Marked as run even though it failed, so it isn't tried again.
        expect((await completionOf(transaction.id)).completionHookRanAt).toEqual(expect.any(Date))
        // Clearing the window happened before the mail failed, and went back with it.
        expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
            .toMatchObject({ transactionTimeout: booking.transactionTimeout })
        expect(await prisma.manualTransactionReview.findMany({ where: { transactionId: transaction.id } }))
            .toMatchObject([{ problem: 'COMPLETION_HOOK_FAILED' }])
        // The payment itself still stands.
        expect(await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id: transaction.id } }))
            .toMatchObject({ state: 'SUCCEEDED' })
    })
})
