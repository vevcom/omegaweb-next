import '@pn-server-only'
import { calculateCreditFees, calculateDebitFees } from './calculateFees'
import { determineTransactionState } from './determineTransactionState'
import { runPaymentCompletionHook } from './paymentCompletionHooks'
import { ledgerTransactionAuth } from './auth'
import { ledgerTransactionSchemas } from './schemas'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { resolveAccountOwnership, resolveAccountsOwnership } from '@/services/ledger/accounts/ownership'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { Smorekopp, ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import logger from '@/lib/logger'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { ExpandedLedgerTransaction } from './types'
import type { ExpandedPayment } from '@/services/ledger/payments/types'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Resolves the owning users/groups of a transaction's ledger entries, for authorizers that need
 * to know whether the caller is a party to it. By default resolves every account the transaction
 * touches, debited or credited (see read below); with `debitedOnly`, resolves only the debited
 * side (see cancel below) - being credited by a transaction was never this caller's money to
 * begin with, so that alone shouldn't let them cancel someone else's attempt at it. A DEPOSIT has
 * no debit side at all (its debit side is external to the ledger - see
 * ledgerTransactionAuth.create), so debitedOnly falls back to every party for one, the same as
 * read: being credited (the depositor's own account) is the only bar there is to be. Every other
 * purpose paid wholly through Stripe also has no debit entry, but there the credited side is the
 * destination account (e.g. the hosting committee), not the payer - falling back the same way
 * would let a member of that account cancel someone else's payment attempt, so debitedOnly
 * returns no accounts at all for those instead, leaving only LEDGER_ADMIN able to cancel it.
 */
async function resolveTransactionAccounts(
    prisma: Prisma.TransactionClient,
    transactionId: number,
    { debitedOnly = false }: { debitedOnly?: boolean } = {},
) {
    const transaction = await prisma.ledgerTransaction.findUnique({
        where: { id: transactionId },
        select: {
            purpose: true,
            ledgerEntries: {
                select: {
                    funds: true,
                    fees: true,
                    ledgerAccount: {
                        select: { user: { select: { id: true } }, groups: { select: { groupId: true } } },
                    },
                },
            },
        },
    })

    const entries = transaction?.ledgerEntries ?? []
    const debitEntries = entries.filter(entry => entry.funds < 0 || (entry.fees ?? 0) < 0)

    let relevantEntries = entries
    if (debitedOnly && debitEntries.length > 0) {
        relevantEntries = debitEntries
    } else if (debitedOnly && transaction?.purpose !== 'DEPOSIT') {
        relevantEntries = []
    }

    return relevantEntries.map(entry => ({
        userId: entry.ledgerAccount?.user?.id ?? null,
        groupIds: entry.ledgerAccount?.groups.map(group => group.groupId) ?? [],
    }))
}

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
        operation: async ({ prisma, params }) => {
            const transaction = await prisma.ledgerTransaction.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                include: {
                    ledgerEntries: true,
                    payment: {
                        include: {
                            // See ExpandedLedgerTransaction's comment: no clientSecret/paymentIntentId here.
                            stripePayment: { select: { createdAt: true, updatedAt: true } },
                            manualPayment: true,
                        },
                    },
                    // See ExpandedLedgerTransaction's comment: no secret, notes, tenantNotes,
                    // userId or guestUserId here.
                    booking: {
                        select: {
                            start: true,
                            end: true,
                            numberOfMembers: true,
                            numberOfNonMembers: true,
                            totalPrice: true,
                            event: { select: { name: true } },
                        },
                    },
                    eventRegistration: {
                        include: {
                            event: { select: { name: true, location: true, eventStart: true, eventEnd: true } },
                        },
                    },
                    purchase: {
                        include: {
                            shop: { select: { name: true } },
                            PurchaseProduct: { include: { product: { select: { name: true } } } },
                        },
                    },
                },
            })

            return transaction
        }
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
            include: {
                ledgerEntries: true,
                payment: {
                    include: {
                        // See ExpandedLedgerTransaction's comment: no clientSecret/paymentIntentId here.
                        stripePayment: { select: { createdAt: true, updatedAt: true } },
                        manualPayment: true,
                    },
                },
                // See ExpandedLedgerTransaction's comment: no secret, notes, tenantNotes, userId
                // or guestUserId here.
                booking: {
                    select: {
                        start: true,
                        end: true,
                        numberOfMembers: true,
                        numberOfNonMembers: true,
                        totalPrice: true,
                        event: { select: { name: true } },
                    },
                },
                eventRegistration: {
                    include: {
                        event: { select: { name: true, location: true, eventStart: true, eventEnd: true } },
                    },
                },
                purchase: {
                    include: {
                        shop: { select: { name: true } },
                        PurchaseProduct: { include: { product: { select: { name: true } } } },
                    },
                },
            },
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

            const balances = transaction.ledgerEntries.length > 0
                ? await ledgerAccountOperations.calculateBalances({
                    params: {
                        ledgerAccountIds: transaction.ledgerEntries.map(entry => entry.ledgerAccountId),
                        atTransactionId: transaction.id,
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

            const transition = await determineTransactionState({ transaction, balances, frozenAccountIds })

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

            if (transaction.state === 'FAILED') {
                // TODO: Better error message.
                throw new ServiceError('BAD PARAMETERS', transaction.reason ?? 'Transaksjonen feilet av ukjent årsak.')
            }

            return transaction
        }
    }),
} as const
