import '@pn-server-only'
import { calculateCreditFees, calculateDebitFees } from './calculateFees'
import { determineTransactionState } from './determineTransactionState'
import { ledgerTransactionAuth } from './auth'
import { ledgerTransactionSchemas } from './schemas'
import { expandedLedgerTransactionIncluder, hasPaymentCompletionHook } from './constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { paymentIncluder } from '@/services/ledger/payments/constants'
import { resolveAccountOwnership, resolveAccountsOwnership } from '@/services/ledger/accounts/ownership'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { Smorekopp, ServiceError } from '@/services/error'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { Prisma as PrismaRuntime } from '@/prisma-generated-pn-client'
import type { ExpandedLedgerTransaction } from './types'
import type { ExpandedPayment } from '@/services/ledger/payments/types'

/**
 * Reads a single transaction including its ledger entries, payment and manual transfer (if any).
 */
const read = defineSubOperation({
    paramsSchema: () => ledgerTransactionSchemas.params.read,
    operation: () => async ({ prisma, params }): Promise<ExpandedLedgerTransaction> =>
        await prisma.ledgerTransaction.findUniqueOrThrow({
            where: {
                id: params.id,
            },
            include: expandedLedgerTransactionIncluder,
        }),
})

/**
 * Cancels a PENDING transaction and its payment, so a late webhook can't mark it SUCCEEDED.
 * Throws if the transaction has already resolved, even when that happens during the cancel.
 */
const cancel = defineSubOperation({
    paramsSchema: () => ledgerTransactionSchemas.params.cancel,
    operation: () => async ({ prisma, params }): Promise<ExpandedLedgerTransaction> => {
        const transaction = await read.internalCall({ params: { id: params.id } })

        if (transaction.state !== 'PENDING') {
            throw new Smorekopp('BAD PARAMETERS', 'Bare en ventende transaksjon kan kanselleres.')
        }

        if (transaction.payment) {
            await paymentOperations.internal.cancel.internalCall({
                params: { paymentId: transaction.payment.id },
            })
        }

        const { count } = await prisma.ledgerTransaction.updateMany({
            where: {
                id: params.id,
                state: 'PENDING', // Protect against canceling a transaction that just resolved.
            },
            data: {
                state: 'CANCELED',
                reason: 'Kansellert.',
            },
        })
        // A concurrent advance() resolved it after the check above, so callers must not act as if it was canceled.
        if (count === 0) {
            throw new Smorekopp('BAD PARAMETERS', 'Bare en ventende transaksjon kan kanselleres.')
        }

        return await read.internalCall({ params: { id: params.id } })
    },
})

/**
 * Starts the transaction's PENDING payment, cancelling the transaction if that fails so it isn't
 * stuck. Use this, not paymentOperations.internal.initiate. Returns the full payment (with its live
 * client secret), or null if the transaction has none.
 */
const initiate = defineSubOperation({
    paramsSchema: () => ledgerTransactionSchemas.params.initiate,
    opensTransaction: true,
    operation: () => async ({ prisma, params }): Promise<ExpandedPayment | null> => {
        const transaction = await read.internalCall({ params: { id: params.id } })
        if (!transaction.payment) return null

        if (transaction.payment.state !== 'PENDING') {
            return await prisma.payment.findUniqueOrThrow({
                where: { id: transaction.payment.id },
                include: paymentIncluder,
            })
        }

        try {
            return await paymentOperations.internal.initiate.internalCall({
                params: { paymentId: transaction.payment.id },
            })
        } catch (error) {
            // Canceled so the payer can start over. If that fails too, the ledger sweeper cancels
            // it once it is stale.
            await cancel.internalCall({ params: { id: params.id } }).catch(() => undefined)
            throw error
        }
    },
})

/**
 * Tries to advance the transactions state to a terminal state.
 * Also, updates the fees if possible.
 */
const advance = defineSubOperation({
    paramsSchema: () => ledgerTransactionSchemas.params.advance,
    operation: () => async ({ prisma, params }): Promise<ExpandedLedgerTransaction> => {
        let transaction = await read.internalCall({ params: { id: params.id } })

        const creditFees = calculateCreditFees(transaction.ledgerEntries, transaction.payment)

        // Update credit fees if they could be calculated. Credit fees are null while the payment
        // is pending, since the final fees are unknown until the payment is completed. Written
        // only while still PENDING, so a transaction that settled concurrently keeps its fees.
        if (creditFees) {
            for (const entry of transaction.ledgerEntries.filter(credit => credit.funds > 0)) {
                await prisma.ledgerEntry.updateMany({
                    where: { id: entry.id, ledgerTransaction: { state: 'PENDING' } },
                    data: { fees: creditFees[entry.ledgerAccountId] },
                })
                entry.fees = creditFees[entry.ledgerAccountId] ?? entry.fees
            }
        }

        // Lock the debited accounts before reading their balance, so concurrent advance() calls can't
        // both see enough funds. Sorted to avoid deadlocks; credits can't overdraw an account.
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

        // Live balance, not limited to entries before this id: a later debit that already SUCCEEDED
        // (e.g. while this one sat on a slow checkout) must count too.
        const balances = transaction.ledgerEntries.length > 0
            ? await ledgerAccountOperations.internal.calculateBalances.internalCall({
                params: {
                    ledgerAccountIds: transaction.ledgerEntries.map(entry => entry.ledgerAccountId),
                },
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

        let transition = determineTransactionState({ transaction, balances, frozenAccountIds })

        // Only one transaction may succeed with a payment, so claim it atomically on a fresh PENDING ->
        // SUCCEEDED transition. The `where` also accepts this transaction's own earlier claim, so a
        // serialized retry (e.g. a duplicate webhook) doesn't fail.
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
            // Requested in the same write as the success, so the payment completion worker only
            // sees it once the success has committed.
            data: {
                ...transition,
                ...(transition.state === 'SUCCEEDED' && hasPaymentCompletionHook(transaction.purpose) && {
                    completionHookRequestedAt: new Date(),
                }),
            },
        })

        transaction = await read.internalCall({ params: { id: params.id } })

        // A concurrent cancel() can commit between our claim and the update above (count 0), orphaning
        // the claim so no reimbursement would ever run. Release it, if it is ours.
        if (count === 0 && transaction.state !== 'SUCCEEDED' && transaction.paymentId !== null) {
            await prisma.payment.updateMany({
                where: { id: transaction.paymentId, claimedByTransactionId: params.id },
                data: { claimedByTransactionId: null },
            })
        }

        return transaction
    },
})

/**
 * Creates a ledger transaction with the given entries, optionally linked to a payment and/or a
 * manual transfer. Fees and the transaction's lifecycle are handled automatically.
 */
const create = defineSubOperation({
    paramsSchema: () => ledgerTransactionSchemas.params.create,
    operation: () => async ({ prisma, params }): Promise<ExpandedLedgerTransaction> => {
        // Calculate the balance for all accounts which are going to be deducted.
        const debitEntries = params.ledgerEntries.filter(entry => entry.funds < 0)
        // calculateBalances rejects an empty filter, so skip it when there are no debit
        // entries, as with deposits.
        const balances = debitEntries.length > 0
            ? await ledgerAccountOperations.internal.calculateBalances.internalCall({
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

        const transaction = await advance.internalCall({ params: { id } })

        // Every transition to FAILED gives its reason (see determineTransactionState), which is the
        // message the caller needs, so the fallback is only a safety net.
        if (transaction.state === 'FAILED') {
            throw new ServiceError('BAD PARAMETERS', transaction.reason ?? 'Transaksjonen feilet av ukjent årsak.')
        }

        return transaction
    },
})

export const ledgerTransactionOperations = {
    internal: {
        read,
        cancel,
        initiate,
        advance,
        create,
    },

    cancel: cancel.implement({
        authorizer: () => ledgerTransactionAuth.cancel,
        ownershipCheck: () => true,
    }),

    /**
     * Same as cancel, opening its own transaction around it - for the client-facing cancel
     * button, the only caller that doesn't already run inside one (every other caller, e.g.
     * createPayment, nests cancel in its own). cancel's two writes - its payment's, and the
     * transaction's own - are otherwise only atomic together by accident of whichever
     * transaction happens to already be ambient when it's called. Deliberately reuses cancel's
     * own params schema and authorizer rather than declaring matching ones under this name: it's
     * the exact same check and shape, not a different operation that happens to look similar.
     */
    cancelOwn: defineOperation({
        authorizer: () => ledgerTransactionAuth.cancel,
        paramsSchema: ledgerTransactionSchemas.params.cancel,
        opensTransaction: true,
        operation: async ({ prisma, params }): Promise<ExpandedLedgerTransaction> => prisma.$transaction(tx =>
            cancel.internalCall({ params, prisma: tx })),
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
     * Holds the rule that the caller owns every account it debits. Server code that has already
     * decided who pays, such as the kiosk, uses `internal.create` instead.
     */
    create: create.implement({
        authorizer: async ({ params, prisma }) => {
            const debitLedgerAccountIds = params.ledgerEntries
                .filter(entry => entry.funds < 0)
                .map(entry => entry.ledgerAccountId)

            return ledgerTransactionAuth.create({
                debitLedgerAccountIds,
                debitAccounts: await resolveAccountsOwnership(prisma, { ledgerAccountIds: debitLedgerAccountIds }),
            })
        },
        ownershipCheck: () => true,
    }),
} as const
