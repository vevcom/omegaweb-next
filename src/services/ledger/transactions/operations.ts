import '@pn-server-only'
import { calculateCreditFees, calculateDebitFees } from './calculateFees'
import { determineTransactionState } from './determineTransactionState'
import { runPaymentCompletionHook } from './paymentCompletionHooks'
import { ledgerTransactionAuth } from './auth'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { resolveAccountOwnership, resolveAccountsOwnership } from '@/services/ledger/accounts/ownership'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { Smorekopp, ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import logger from '@/lib/logger'
import { LedgerTransactionPurpose } from '@/prisma-generated-pn-types'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { z } from 'zod'
import type { ExpandedLedgerTransaction } from './types'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Resolves the owning users/groups of every account a transaction's ledger entries touch, for
 * authorizers that need to know whether the caller is a party to it (see read/cancel below).
 */
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
        paramsSchema: z.object({
            id: z.number(),
        }),
        operation: async ({ prisma, params }) => {
            const transaction = await prisma.ledgerTransaction.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                include: {
                    ledgerEntries: true,
                    payment: {
                        include: {
                            stripePayment: true,
                            manualPayment: true,
                        },
                    },
                    booking: {
                        include: {
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
            accounts: await resolveTransactionAccounts(prisma, params.id),
        }),
        paramsSchema: z.object({
            id: z.number(),
        }),
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
     * Read several ledger transactions including its ledger entries, payment and manual transfer (if any).
     */
    readPage: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerTransactionAuth.readPage.data({
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: params.paging.details.accountId })],
        }),
        paramsSchema: readPageInputSchemaObject(
            z.object({
                id: z.number(),
            }),
            z.object({
                accountId: z.number(),
            }),
        ),
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
                        stripePayment: true,
                        manualPayment: true,
                    },
                },
                booking: {
                    include: {
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
        paramsSchema: z.object({
            id: z.number(),
        }),
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
        paramsSchema: z.object({
            purpose: z.nativeEnum(LedgerTransactionPurpose),
            ledgerEntries: z.object({
                funds: z.number(),
                fees: z.number().optional(),
                ledgerAccountId: z.number(),
            }).array(),
            paymentId: z.number().optional(),
            description: z.string().optional(),
            // Traceability back to what the transaction paid for. At most one is ever set,
            // depending on `purpose`.
            eventRegistrationId: z.number().optional(),
            bookingId: z.number().optional(),
            purchaseId: z.number().optional(),
        }),
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
