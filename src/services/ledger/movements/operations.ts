import '@pn-server-only'
import { ledgerMovementAuth } from './auth'
import { ledgerMovementSchemas } from './schemas'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import { defineOperation } from '@/services/serviceOperation'

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
     * @params params.amount The amount to be deposited.
     * @params params.ledgerAccountId The ID of the ledger account where the funds will be deposited.
     *
     * @return The created transaction representing the deposit operation.
     */
    createDeposit: defineOperation({
        authorizer: () => ledgerMovementAuth.createDeposit,
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

            let resolvedPayment = created.payment
            if (resolvedPayment.state === 'PENDING') {
                resolvedPayment = await paymentOperations.initiate({
                    params: { paymentId: resolvedPayment.id },
                })
            }

            // The depositor is paying through this very response. LedgerTransactionModal reads
            // payment.stripePayment.clientSecret off it, so return the full payment already in
            // hand instead of transaction's narrowed copy of it.
            return { ...created.transaction, payment: resolvedPayment }
        }
    }),

    /**
     * Creates a payout transaction, which is a withdrawal of funds from the ledger.
     *
     * @params params.amount The amount to be withdrawn.
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
        operation: async ({ prisma, params, session }) => prisma.$transaction(async tx => {
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

            // A payout is always implicitly manual, so it isn't itself LEDGER_ADMIN-gated (any
            // account owner can self-serve one). A caller-supplied description is only honored
            // for admins; everyone else falls back to a translated purpose label instead.
            const isAdmin = session.permissions.includes('LEDGER_ADMIN')

            const transaction = await ledgerTransactionOperations.create({
                params: {
                    purpose: 'PAYOUT',
                    ledgerEntries: [{
                        ledgerAccountId: params.ledgerAccountId,
                        funds: -params.funds,
                        fees: -params.fees,
                    }],
                    paymentId: payment.id,
                    description: isAdmin ? params.description : undefined,
                },
                prisma: tx,
            })

            // The caller's own modal reads payment.stripePayment off this response directly, so
            // return the full payment already in hand instead of transaction's narrowed copy of
            // it.
            return { ...transaction, payment }
        })
    }),
} as const
