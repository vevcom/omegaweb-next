import '@pn-server-only'
import { calculateCreditFees, calculateDebitFees } from './calculateFees'
import { determineTransactionState } from './determineTransactionState'
import { hasPaymentCompletionHook } from './paymentCompletionHooks'
import { ledgerTransactionAuth } from './auth'
import { ledgerTransactionSchemas } from './schemas'
import { expandedLedgerTransactionInclude } from './constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { resolveAccountOwnership, resolveAccountsOwnership } from '@/services/ledger/accounts/ownership'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { Smorekopp, ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { Prisma as PrismaRuntime } from '@/prisma-generated-pn-client'
import type { ExpandedLedgerTransaction } from './types'
import type { ExpandedPayment } from '@/services/ledger/payments/types'
import type { Prisma } from '@/prisma-generated-pn-types'

/** Resolves the owners of a transaction's accounts, for authorizers. */
async function resolveTransactionAccounts(prisma: Prisma.TransactionClient, transactionId: number) {
    const transaction = await prisma.ledgerTransaction.findUnique({
        where: { id: transactionId },
        select: {
            ledgerEntries: {
                select: {
                    ledgerAccount: {
                        select: { user: { select: { id: true } }, groups: { select: { groupId: true } } },
                    },
                },
            },
        },
    })

    return (transaction?.ledgerEntries ?? []).map(entry => ({
        userId: entry.ledgerAccount.user?.id ?? null,
        groupIds: entry.ledgerAccount.groups.map(group => group.groupId),
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
                include: expandedLedgerTransactionInclude,
            })

            return transaction
        }
    }),

    /** Cancels a PENDING transaction and its payment, so a late webhook can't mark it SUCCEEDED. */
    cancel: defineOperation({
        authorizer: () => ledgerTransactionAuth.cancel,
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
     * Starts the transaction's PENDING payment, cancelling the transaction if that fails so it isn't
     * stuck. Use this, not paymentOperations.initiate. Returns the full payment (with its live
     * client secret), or null if the transaction has none.
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
                // Canceled so the payer can start over. If that fails too, the ledger sweeper cancels
                // it once it is stale.
                await ledgerTransactionOperations.cancel({ params: { id: params.id }, bypassAuth: true })
                    .catch(() => undefined)
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
            include: expandedLedgerTransactionInclude,
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
            // Bypassed: the transaction can span two parties (e.g. buyer and shop group), and an
            // ownership check would reject whichever side isn't the caller.
            let transaction: ExpandedLedgerTransaction = await ledgerTransactionOperations.read({
                params: { id: params.id },
                bypassAuth: true,
            })

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

            transaction = await ledgerTransactionOperations.read({
                params: { id: params.id },
                bypassAuth: true,
            })

            // A concurrent cancel() can commit between our claim and the update above (count 0), orphaning
            // the claim so no reimbursement would ever run. Release it, if it is ours.
            if (count === 0 && transaction.state !== 'SUCCEEDED' && transaction.paymentId !== null) {
                await prisma.payment.updateMany({
                    where: { id: transaction.paymentId, claimedByTransactionId: params.id },
                    data: { claimedByTransactionId: null },
                })
            }

            return transaction
        }
    }),

    /**
     * Creates a ledger transaction with the given entries, optionally linked to a payment and/or a
     * manual transfer. Fees and the transaction's lifecycle are handled automatically.
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
