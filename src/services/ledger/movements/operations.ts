import '@pn-server-only'
import { ledgerMovementAuth } from './auth'
import { ledgerMovementSchemas } from './schemas'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { STRIPE_MINIMUM_PAYMENT_AMOUNT } from '@/services/ledger/payments/constants'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import { displayAmount } from '@/lib/currency/convert'
import { Smorekopp } from '@/services/error'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import type { CreatedPayment, CreatePaymentImplementationFields, PaymentCharge } from './types'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Pays for what an implementing service charges: `amountFromBalance` from the payer's balance and
 * the rest through `provider`, which is only required when the balance doesn't cover the price. The
 * payment is started once the transaction has committed. If starting it fails, the transaction is
 * canceled, so it can be paid for again.
 *
 * The nested payment and transaction creation are not internal calls, since they hold the ledger's
 * own rules: MANUAL payments take LEDGER_ADMIN, and the payer must own the account it pays from.
 */
const createPayment = defineSubOperation({
    paramsSchema: () => ledgerMovementSchemas.params.createPayment,
    opensTransaction: true,
    operation: ({ purpose, descriptionShort, prepare }: CreatePaymentImplementationFields) =>
        async ({ prisma, params, session }): Promise<CreatedPayment> => {
            const transaction = await prisma.$transaction(async tx => {
                const charge = await prepare(tx, { session })

                if (params.amountFromBalance > charge.funds) {
                    throw new Smorekopp('BAD PARAMETERS', 'Beløpet fra kontosaldo kan ikke overstige prisen.')
                }
                if (params.amountFromBalance > 0 && charge.payerUserId === null) {
                    throw new Smorekopp('BAD PARAMETERS', 'Bare innloggede brukere kan betale med kontosaldo.')
                }
                const shortfall = charge.funds - params.amountFromBalance
                if (shortfall > 0 && !params.provider) {
                    throw new Smorekopp('BAD PARAMETERS', 'Betalingsmetode må oppgis.')
                }

                if (charge.link) await settleEarlierAttempt(tx, charge)

                const payment = shortfall > 0
                    ? await paymentOperations.create({
                        params: {
                            provider: params.provider!,
                            funds: shortfall,
                            manualFees: params.manualFees,
                            descriptionLong: charge.descriptionLong,
                            descriptionShort,
                        },
                        prisma: tx,
                    })
                    : null

                const payerAccount = params.amountFromBalance > 0
                    ? await ledgerAccountOperations.internal.read.internalCall({
                        params: { userId: charge.payerUserId! },
                        prisma: tx,
                    })
                    : null

                return await ledgerTransactionOperations.create({
                    params: {
                        purpose,
                        ledgerEntries: [
                            { ledgerAccountId: charge.destinationLedgerAccountId, funds: charge.funds },
                            ...(payerAccount
                                ? [{ ledgerAccountId: payerAccount.id, funds: -params.amountFromBalance }]
                                : []),
                        ],
                        paymentId: payment?.id,
                        description: params.provider === 'MANUAL' ? params.description : undefined,
                        ...charge.link,
                    },
                    prisma: tx,
                })
            })

            return {
                transaction,
                payment: await ledgerTransactionOperations.internal.initiate.internalCall({
                    params: { id: transaction.id },
                }),
            }
        },
})

// `ledgerMovementOperations` provides functions to orchestrate account related actions,
// such as depositing funds or creating payouts. If the ledger is needed for
// other purposes, such as creating a transaction, it should be done through
// `ledgerTransactionOperations`.
export const ledgerMovementOperations = {
    internal: {
        createPayment,
    },

    /**
     * Creates a deposit transaction, which is a deposit of funds into the ledger.
     *
     * @param implementationParams.funds The amount to be deposited, at least STRIPE_MINIMUM_PAYMENT_AMOUNT
     * when paying by card.
     * @param implementationParams.ledgerAccountId The ID of the ledger account where the funds will be deposited.
     */
    createDeposit: createPayment.implement({
        implementationParamsSchema: ledgerMovementSchemas.params.createDeposit,
        authorizer: async ({ implementationParams, prisma }) => ledgerMovementAuth.createDeposit.data({
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: implementationParams.ledgerAccountId })],
        }),
        ownershipCheck: () => true,
        // Stripe's own processing floor, so a MANUAL deposit has none.
        beforeRun: ({ params, implementationParams }) => {
            if (params.provider === 'STRIPE' && implementationParams.funds < STRIPE_MINIMUM_PAYMENT_AMOUNT) {
                throw new Smorekopp(
                    'BAD PARAMETERS',
                    `Innskudd med kort må være minst ${displayAmount(STRIPE_MINIMUM_PAYMENT_AMOUNT, false)}.`
                )
            }
        },
        operationImplementationFields: ({ implementationParams }) => ({
            purpose: 'DEPOSIT',
            descriptionShort: 'Innskudd',
            prepare: () => ({
                funds: implementationParams.funds,
                destinationLedgerAccountId: implementationParams.ledgerAccountId,
                payerUserId: null,
                descriptionLong: 'Innskudd til veven',
                link: null,
                replacesPendingAttempt: false,
            }),
        }),
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
        authorizer: () => ledgerMovementAuth.createPayout,
        paramsSchema: ledgerMovementSchemas.params.createPayout,
        opensTransaction: true,
        // Internal calls, since the payout's own rule is stricter than the payment's and the transaction's.
        operation: async ({ prisma, params }): Promise<CreatedPayment> => prisma.$transaction(async tx => {
            const payment = await paymentOperations.internal.create.internalCall({
                params: {
                    provider: 'MANUAL',
                    descriptionLong: 'Utbetaling fra veven',
                    descriptionShort: 'Utbetaling',
                    funds: -params.funds,
                    manualFees: -params.fees,
                },
                prisma: tx,
            })

            const transaction = await ledgerTransactionOperations.internal.create.internalCall({
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

            return { transaction, payment }
        })
    }),
} as const

/**
 * Refuses to pay twice for the same thing. A PENDING attempt, such as a Stripe checkout still open
 * in another tab, is canceled so a late webhook can't complete it, if the charge says it may be
 * replaced.
 */
async function settleEarlierAttempt(tx: Prisma.TransactionClient, charge: PaymentCharge) {
    const earlierAttempt = await tx.ledgerTransaction.findFirst({
        where: {
            ...charge.link,
            state: { in: ['PENDING', 'SUCCEEDED'] },
        },
        select: { id: true, state: true },
    })
    if (!earlierAttempt) return

    if (earlierAttempt.state === 'SUCCEEDED') {
        throw new Smorekopp('BAD PARAMETERS', 'Dette er allerede betalt.')
    }
    if (!charge.replacesPendingAttempt) {
        throw new Smorekopp('BAD PARAMETERS', 'Det er allerede en betaling under behandling.')
    }
    await ledgerTransactionOperations.internal.cancel.internalCall({
        params: { id: earlierAttempt.id },
        prisma: tx,
    })
}
