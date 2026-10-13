import '@pn-server-only'
import { calculateCreditFees, calculateDebitFees } from './calculateFees'
import { determineTransactionState } from './determineTransactionState'
import { runPaymentCompletionHook } from './paymentCompletionHooks'
import { ledgerTransactionAuth } from './auth'
import { ledgerTransactionSchemas } from './schemas'
import { expandedLedgerTransactionIncluder } from './constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import {
    resolveAccountOwnership,
    resolveAccountsOwnership,
    resolveTransactionAccounts,
} from '@/services/ledger/accounts/ownership'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { Smorekopp, ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import logger from '@/lib/logger'
import { Prisma as PrismaRuntime } from '@/prisma-generated-pn-client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { ExpandedLedgerTransaction } from './types'
import type { ExpandedPayment } from '@/services/ledger/payments/types'
import type { Prisma } from '@/prisma-generated-pn-types'

// Nested calls to other operations are not bypassed unless noted: the checks involved are cheap,
// so it is worth checking access again rather than assuming the outer check already covered it.
export const ledgerTransactionOperations = {
    /**
     * Reads a single transaction including its ledger entries, payment and manual transfer (if any).
     */
    read: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerTransactionAuth.read.data({
            accounts: await resolveTransactionAccounts(prisma, params.id),
        }),
        paramsSchema: ledgerTransactionSchemas.params.read,
        operation: async ({ prisma, params }) => await prisma.ledgerTransaction.findUniqueOrThrow({
            where: {
                id: params.id,
            },
            include: expandedLedgerTransactionIncluder,
        }),
    }),

    /**
     * Cancels a transaction that is still PENDING (e.g. a stale/abandoned Stripe attempt).
     * Cancels its payment too (see paymentOperations.cancel), so a webhook that arrives late can
     * never later mark it SUCCEEDED. Refuses to touch a transaction that already reached a
     * terminal state.
     */
    cancel: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerTransactionAuth.cancel.data({
            accounts: await resolveTransactionAccounts(prisma, params.id, { debitedOnly: true }),
        }),
        paramsSchema: ledgerTransactionSchemas.params.cancel,
        operation: async ({ prisma, params }) => {
            const transaction: ExpandedLedgerTransaction = await ledgerTransactionOperations.read({
                params: { id: params.id },
                bypassAuth: true,
            })

            if (transaction.state !== 'PENDING') {
                throw new Smorekopp('BAD PARAMETERS', 'Bare en ventende transaksjon kan kanselleres.')
            }

            if (transaction.payment) {
                // Bypassed: the authorizer above already established the caller may cancel this
                // transaction (a party to it, or LEDGER_ADMIN) - that's the right bar for
                // canceling its payment too, not paymentAuth.cancel's own generic LEDGER_USE.
                await paymentOperations.cancel({
                    params: { paymentId: transaction.payment.id },
                    bypassAuth: true,
                })
            }

            await prisma.ledgerTransaction.updateMany({
                where: {
                    id: params.id,
                    state: 'PENDING', // Protect against canceling a transaction that just resolved.
                },
                data: {
                    state: 'CANCELED',
                    reason: 'Kansellert.',
                },
            })

            const canceled: ExpandedLedgerTransaction = await ledgerTransactionOperations.read({
                params: { id: params.id },
                bypassAuth: true,
            })
            return canceled
        },
    }),

    /**
     * Starts collecting a transaction's own payment, if it has one and it's still PENDING -
     * every caller that creates a transaction backed by a fresh payment needs this, not
     * paymentOperations.initiate directly: a payment no longer unambiguously knows which
     * transaction depends on it (one can be reused across claims), but the transaction does,
     * which is what lets this cancel itself if starting the payment fails, instead of being
     * left stuck with no way to ever pay for it. Returns the full payment (its live Stripe
     * client secret, not ExpandedLedgerTransaction's restricted copy), or null if the
     * transaction has none at all.
     */
    initiate: defineOperation({
        authorizer: () => ledgerTransactionAuth.initiate,
        paramsSchema: ledgerTransactionSchemas.params.initiate,
        opensTransaction: true,
        operation: async ({ prisma, params }): Promise<ExpandedPayment | null> => {
            const transaction = await ledgerTransactionOperations.read({
                params: { id: params.id },
                bypassAuth: true,
            })
            if (!transaction.payment) return null

            if (transaction.payment.state !== 'PENDING') {
                return await prisma.payment.findUniqueOrThrow({
                    where: { id: transaction.payment.id },
                    include: { stripePayment: true, manualPayment: true },
                })
            }

            try {
                return await paymentOperations.initiate({ params: { paymentId: transaction.payment.id } })
            } catch (error) {
                // A concurrent cancellation can make the initiate call above throw because the
                // payment was pulled out from under it - cancel then finds the transaction already
                // non-PENDING and throws its own guard error, which would otherwise replace the
                // real one. Swallow only that expected race; any other cleanup failure (e.g. cancel
                // itself hitting a real error) must still surface.
                try {
                    await ledgerTransactionOperations.cancel({ params: { id: params.id }, bypassAuth: true })
                } catch (cleanupError) {
                    if (
                        !(cleanupError instanceof Smorekopp)
                        || cleanupError.errors[0]?.message !== 'Bare en ventende transaksjon kan kanselleres.'
                    ) {
                        throw cleanupError
                    }
                }
                throw error
            }
        },
    }),

    /**
     * Read several ledger transactions including its ledger entries, payment and manual transfer (if any).
     */
    readPage: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerTransactionAuth.readPage.data({
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: params.paging.details.accountId })],
        }),
        paramsSchema: ledgerTransactionSchemas.params.readPage,
        operation: async ({ prisma, params }) => await prisma.ledgerTransaction.findMany({
            where: {
                ledgerEntries: {
                    some: {
                        ledgerAccountId: params.paging.details.accountId,
                    },
                },
            },
            include: expandedLedgerTransactionIncluder,
            orderBy: [
                { createdAt: 'desc' },
                { id: 'desc' },
            ],
            ...cursorPagingSelection(params.paging.page)
        })
    }),

    /**
     * Tries to advance the transactions state to a terminal state.
     * Also, updates the fees if possible.
     */
    advance: defineOperation({
        authorizer: () => ledgerTransactionAuth.advance,
        paramsSchema: ledgerTransactionSchemas.params.advance,
        operation: async ({ prisma, params }) => {
            // advance recomputes the whole transaction, which can span two unrelated parties
            // (e.g. a purchase debits the buyer and credits a shop group). Every call below is
            // bypassed for that reason: an ownership check would reject whichever side isn't
            // the actual caller.
            let transaction: ExpandedLedgerTransaction = await ledgerTransactionOperations.read({
                params: { id: params.id },
                bypassAuth: true,
            })

            const creditFees = calculateCreditFees(transaction.ledgerEntries, transaction.payment)

            // Update credit fees if they could be calculated.
            // Credit fees are null while the payment is pending, since
            // the final fees are unknown until the payment is completed.
            if (creditFees) {
                const creditEntries = transaction.ledgerEntries.filter(entry => entry.funds > 0)

                const ledgerEntryUpdateInput = creditEntries.map(entry => ({
                    where: {
                        id: entry.id,
                    },
                    data: {
                        fees: creditFees[entry.ledgerAccountId],
                    },
                })) satisfies Prisma.LedgerEntryUpdateWithWhereUniqueWithoutLedgerTransactionInput[] // X_x

                try {
                    await prisma.ledgerTransaction.update({
                        where: {
                            id: params.id,
                            state: 'PENDING', // Protect against modifying a completed transaction.
                        },
                        data: {
                            ledgerEntries: {
                                update: ledgerEntryUpdateInput,
                            },
                        },
                    })

                    transaction.ledgerEntries.forEach(entry => {
                        entry.fees = creditFees[entry.ledgerAccountId] ?? entry.fees
                    })
                } catch (err) {
                    // A P2025 here means the transaction left PENDING concurrently, e.g. a
                    // racing duplicate call to advance. The final read below returns whatever
                    // state it actually settled into, so there is nothing more to do here.
                    if (!(err instanceof PrismaClientKnownRequestError) || err.code !== 'P2025') {
                        throw err
                    }

                    logger.error(`Ledger transaction ${params.id} left the PENDING state before fees could be updated.`)
                }
            }

            // Lock the accounts this transaction debits before reading their balance below, so a
            // concurrent advance() on the same account waits its turn instead of racing: both
            // would otherwise compute their balance from the same committed state and could both
            // conclude there's enough left. Sorted ascending so two transactions that debit the
            // same two accounts always lock them in the same order, avoiding a deadlock. Credit-only
            // entries never need this - crediting an account can't make its balance insufficient.
            const debitLedgerAccountIds = Array.from(new Set(transaction.ledgerEntries
                .filter(entry => entry.funds < 0 || (entry.fees ?? 0) < 0)
                .map(entry => entry.ledgerAccountId)))
                .sort((one, other) => one - other)
            if (debitLedgerAccountIds.length > 0) {
                await prisma.$queryRaw`
                    SELECT id FROM "LedgerAccount"
                    WHERE id IN (${PrismaRuntime.join(debitLedgerAccountIds)})
                    ORDER BY id
                    FOR UPDATE
                `
            }

            // Live, unbounded balance, same as create()'s own pre-check below uses - not filtered
            // to entries up to this transaction's own id. This transaction may have been created
            // before another debit on the same account that has since reached SUCCEEDED with a
            // higher id (e.g. it sat PENDING far longer, waiting on a slow Stripe checkout); that
            // debit has already really happened and must count here regardless of id order, or
            // this check would wrongly see enough balance and let the account go negative.
            const balances = transaction.ledgerEntries.length > 0
                ? await ledgerAccountOperations.calculateBalances({
                    params: {
                        ledgerAccountIds: transaction.ledgerEntries.map(entry => entry.ledgerAccountId),
                    },
                    bypassAuth: true,
                })
                : {}

            // Find frozen accounts, if any, among the involved ledger accounts.
            const frozenAccounts = await prisma.ledgerAccount.findMany({
                where: {
                    id: {
                        in: transaction.ledgerEntries.map(entry => entry.ledgerAccountId),
                    },
                    frozen: true,
                }
            })
            const frozenAccountIds = new Set(frozenAccounts.map(account => account.id))

            let transition = await determineTransactionState({ transaction, balances, frozenAccountIds })

            // A payment may be shared by more than one transaction, see Payment.ledgerTransactions,
            // but only one of them may ever succeed with it. Claim it atomically here, the moment
            // this transaction is about to become the one. `transaction.state` is still the state
            // from the read at the top of this function, so this only runs on the call that's
            // actually driving a fresh PENDING -> SUCCEEDED transition, never on a retry of an
            // already-terminal transaction. The lock above already serializes two concurrent
            // advance() calls for this same transaction (e.g. a duplicate webhook delivery), but
            // the `where` below still has to recognize a retry of this transaction's own already-
            // successful claim as success too, not a loss - otherwise the second call, now running
            // after the first already committed, would see claimedByTransactionId === params.id
            // (its own id, not null) and wrongly fail a transaction that already succeeded.
            if (transaction.state === 'PENDING' && transition.state === 'SUCCEEDED' && transaction.payment) {
                const { count: claimed } = await prisma.payment.updateMany({
                    where: {
                        id: transaction.payment.id,
                        OR: [{ claimedByTransactionId: null }, { claimedByTransactionId: params.id }],
                    },
                    data: { claimedByTransactionId: params.id },
                })
                if (claimed === 0) {
                    transition = { state: 'FAILED', reason: 'Betalingen er allerede brukt av en annen transaksjon.' }
                }
            }

            // We use `updateMany` in stead of just `update` here because
            // we don't want to throw in case the record is not found.
            const { count } = await prisma.ledgerTransaction.updateMany({
                where: {
                    id: params.id,
                    state: 'PENDING', // Protect against changing final state.
                },
                data: transition,
            })

            transaction = await ledgerTransactionOperations.read({
                params: { id: params.id },
                bypassAuth: true,
            })

            // This call claimed the payment above on the assumption it was driving the
            // transition, but a concurrent cancel() can still have committed a terminal state
            // (e.g. CANCELED) between that claim and the guarded updateMany just above - count
            // is then 0 and the claim is left pointing at a transaction that never actually
            // succeeded, orphaned: refundLateStripeSuccess and reimburseUnappliedPayment both see
            // a non-null claim and refuse to act, so the captured money would never get credited
            // to anyone. Release it, scoped to this call's own id so it can't clear a claim this
            // call never actually held.
            if (count === 0 && transaction.state !== 'SUCCEEDED' && transaction.paymentId !== null) {
                await prisma.payment.updateMany({
                    where: { id: transaction.paymentId, claimedByTransactionId: params.id },
                    data: { claimedByTransactionId: null },
                })
            }

            // count > 0 means this call is the one that actually performed the PENDING ->
            // SUCCEEDED transition (updateMany matches 0 rows once it's already terminal), so
            // the hook fires exactly once no matter how many times/where advance is called from
            // (synchronously from create, or later from the Stripe webhook).
            // TODO: When advance() runs synchronously inside create() from within a caller's
            // prisma.$transaction, prisma here is that ambient tx client, so a hook's side
            // effects (e.g. a confirmation email) can fire before the transaction commits. If the
            // transaction then fails to commit, the side effect already happened. Defer hook
            // execution until after commit instead.
            if (count > 0 && transaction.state === 'SUCCEEDED') {
                await runPaymentCompletionHook(transaction, { prisma })
            }

            return transaction
        }
    }),

    /**
     * Create a new transaction on the ledger with the given entries and optionally
     * link to the provided payment and/or manual transfer.
     *
     * The fees transferred are automatically calculated.
     *
     * The lifecycle of the transaction is automatically handled by the system.
     */
    create: defineOperation({
        authorizer: async ({ params, prisma }) => {
            const debitLedgerAccountIds = params.ledgerEntries
                .filter(entry => entry.funds < 0)
                .map(entry => entry.ledgerAccountId)

            return ledgerTransactionAuth.create({
                debitLedgerAccountIds,
                debitAccounts: await resolveAccountsOwnership(prisma, { ledgerAccountIds: debitLedgerAccountIds }),
            })
        },
        paramsSchema: ledgerTransactionSchemas.params.create,
        operation: async ({ prisma, params }) => {
            // Calculate the balance for all accounts which are going to be deducted.
            const debitEntries = params.ledgerEntries.filter(entry => entry.funds < 0)
            // calculateBalances rejects an empty filter, so skip it when there are no debit
            // entries, as with deposits.
            const balances = debitEntries.length > 0
                ? await ledgerAccountOperations.calculateBalances({
                    params: { ledgerAccountIds: debitEntries.map(entry => entry.ledgerAccountId) },
                })
                : {}

            // Check that the relevant accounts have enough balance to do the transaction.
            // NOTE: This is check is only to avoid calling the db unnecessarily.
            // The actual validation is handled in the `advance` function.
            const hasInsufficientBalance = debitEntries.some(
                entry => (balances[entry.ledgerAccountId]?.amount ?? 0) + entry.funds < 0
            )
            if (hasInsufficientBalance) {
                throw new ServiceError('BAD PARAMETERS', 'Konto har for lav balanse for å utføre transaksjonen.')
            }

            // Calculate and set fees for the debit entries
            const fees = calculateDebitFees(params.ledgerEntries, balances)
            const entries = params.ledgerEntries.map(entry => ({
                ...entry,
                fees: entry.fees ?? fees[entry.ledgerAccountId] ?? null
            }))

            const { id } = await prisma.ledgerTransaction.create({
                data: {
                    purpose: params.purpose,
                    state: 'PENDING',
                    ledgerEntries: {
                        create: entries,
                    },
                    paymentId: params.paymentId,
                    description: params.description,
                    eventRegistrationId: params.eventRegistrationId,
                    bookingId: params.bookingId,
                    purchaseId: params.purchaseId,
                },
                select: {
                    id: true,
                },
            })

            const transaction: ExpandedLedgerTransaction = await ledgerTransactionOperations.advance({
                params: {
                    id,
                },
                bypassAuth: true,
            })

            // Every transition to FAILED gives its reason (see determineTransactionState), which is the
            // message the caller needs, so the fallback is only a safety net.
            if (transaction.state === 'FAILED') {
                throw new ServiceError('BAD PARAMETERS', transaction.reason ?? 'Transaksjonen feilet av ukjent årsak.')
            }

            return transaction
        }
    }),
} as const
