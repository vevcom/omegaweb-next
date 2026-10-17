import '@pn-server-only'
import { ledgerMovementAuth } from './auth'
import { ledgerMovementSchemas } from './schemas'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import { defineOperation } from '@/services/serviceOperation'
import type { ExpandedPayment } from '@/services/ledger/payments/types'

/**
 * `ledgerTransactionOperations.create`'s return narrows `payment` (no live clientSecret, since
 * that type is read broadly by either party to the transaction, not just the payer). The callers
 * here already hold the full payment they just created themselves, and their own modal reads
 * `payment.stripePayment` straight off the response - swap the narrowed copy back out for it.
 */
function withFullPayment<Transaction extends { payment: unknown }>(
    transaction: Transaction,
    payment: ExpandedPayment
): Omit<Transaction, 'payment'> & { payment: ExpandedPayment } {
    return { ...transaction, payment }
}

// `ledgerMovementOperations` provides functions to orchestrate account related actions,
// such as depositing funds or creating payouts. If the ledger is needed for
// other purposes, such as creating a transaction, it should be done through
// `ledgerTransactionOperations`.
//
// Nested calls below are not bypassed: the checks they run are cheap, so it is worth
// checking access again rather than assuming the outer check already covered it.
export const ledgerMovementOperations = {
    /**
     * Creates a deposit transaction, which is a deposit of funds into the ledger.
     *
     * @params params.funds The amount to be deposited, at least STRIPE_MINIMUM_PAYMENT_AMOUNT when paying by card.
     * @params params.ledgerAccountId The ID of the ledger account where the funds will be deposited.
     *
     * @return The created transaction representing the deposit operation.
     */
    createDeposit: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerMovementAuth.createDeposit.data({
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: params.ledgerAccountId })],
        }),
        opensTransaction: true,
        paramsSchema: ledgerMovementSchemas.params.createDeposit,
        operation: async ({ prisma, params }) => {
            const created = await prisma.$transaction(async tx => {
                const payment = await paymentOperations.create({
                    params: {
                        provider: params.provider,
                        funds: params.funds,
                        manualFees: params.manualFees,
                        descriptionLong: 'Innskudd til veven',
                        descriptionShort: 'Innskudd',
                    },
                    prisma: tx,
                })

                const transaction = await ledgerTransactionOperations.create({
                    params: {
                        purpose: 'DEPOSIT',
                        ledgerEntries: [{
                            ledgerAccountId: params.ledgerAccountId,
                            funds: params.funds,
                        }],
                        paymentId: payment.id,
                        description: params.provider === 'MANUAL' ? params.description : undefined,
                    },
                    prisma: tx,
                })

                return { transaction, payment }
            })

            // Starts collecting the payment and returns its live clientSecret -
            // LedgerTransactionModal reads payment.stripePayment.clientSecret off it. initiate
            // cancels the deposit along with it if starting the payment fails, so it isn't left
            // stuck.
            const resolvedPayment = await ledgerTransactionOperations.initiate({
                params: { id: created.transaction.id },
                bypassAuth: true,
            })
            // createDeposit always attaches a payment, so this can never come back null.
            return withFullPayment(created.transaction, resolvedPayment!)
        }
    }),

    /**
     * Creates a payout transaction, which is a withdrawal of funds from the ledger.
     *
     * @params params.funds The amount to be withdrawn.
     * @params params.fees The fees associated with the payout.
     * @params params.ledgerAccountId The ID of the ledger account from which the funds will be withdrawn.
     *
     * @returns The created transaction representing the payout operation.
     */
    createPayout: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerMovementAuth.createPayout.data({
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: params.ledgerAccountId })],
        }),
        paramsSchema: ledgerMovementSchemas.params.createPayout,
        opensTransaction: true,
        operation: async ({ prisma, params }) => prisma.$transaction(async tx => {
            const payment = await paymentOperations.create({
                params: {
                    provider: 'MANUAL',
                    descriptionLong: 'Utbetaling fra veven',
                    descriptionShort: 'Utbetaling',
                    funds: -params.funds,
                    manualFees: -params.fees,
                },
                prisma: tx,
            })

            // A payout is a MANUAL payment, which paymentAuth.create reserves for LEDGER_ADMIN, so the
            // description given is always an admin's.
            const transaction = await ledgerTransactionOperations.create({
                params: {
                    purpose: 'PAYOUT',
                    ledgerEntries: [{
                        ledgerAccountId: params.ledgerAccountId,
                        funds: -params.funds,
                        fees: -params.fees,
                    }],
                    paymentId: payment.id,
                    description: params.description,
                },
                prisma: tx,
            })

            // The caller's own modal reads payment.stripePayment off this response directly.
            return withFullPayment(transaction, payment)
        })
    }),
} as const
