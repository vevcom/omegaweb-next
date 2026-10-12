import '@pn-server-only'
import { ledgerAccountSchemas } from './schemas'
import { ledgerAccountAuth } from './auth'
import { resolveAccountOwnership, resolveAccountsOwnership } from './ownership'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { defineOperation } from '@/services/serviceOperation'
import { LedgerAccountType } from '@/prisma-generated-pn-types'
import { z } from 'zod'
import type { LedgerAccount, Prisma } from '@/prisma-generated-pn-types'
import type { Balance, BalanceRecord, ExpandedLedgerAccount } from './types'

// Nested calls between these operations are not bypassed unless noted otherwise: the checks
// involved are cheap (a session permission, or one indexed lookup), so checking access again
// on each call is worth it. bypassAuth is used only where a nested operation's own policy would
// otherwise reject a caller the outer check already allows.
export const ledgerAccountOperations = {
    /**
     * Creates a new GROUP ledger account. USER accounts are created automatically alongside
     * their User (see userOperations.create and friends) and can't be created through here.
     *
     * @param data.groupIds The IDs of the groups to create the account for.
     *
     * @returns The created account.
     */
    create: defineOperation({
        // Only GROUP accounts are created here, and a group account has no owning user to fall
        // back on, so there is no self-service angle (unlike a USER account, which readOrCreate
        // used to cover): this is admin-only.
        authorizer: () => ledgerAccountAuth.create,
        dataSchema: ledgerAccountSchemas.create,
        operation: async ({ prisma, data }): Promise<LedgerAccount> => prisma.ledgerAccount.create({
            data: {
                type: 'GROUP',
                name: data.name,
                groups: data.groupIds ? {
                    createMany: {
                        data: data.groupIds.map(groupId => ({
                            groupId
                        }))
                    },
                } : undefined,
                payoutAccountNumber: data.payoutAccountNumber,
                frozen: data.frozen,
            }
        }),
    }),

    /**
     * Reads details of a ledger account by ledger account id, user id, or group id.
     *
     * **Note**: The balance of an account is not included in the response.
     * Use the `calculateBalance` method to get the balance.
     *
     * @param params.userId The ID of the user to read the account for.
     * @param params.ledgerAccountId The ID of the ledger account to read.
     *
     * @returns The account details.
     */
    read: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerAccountAuth.read.data({
            accounts: [await resolveAccountOwnership(prisma, params)],
        }),
        paramsSchema: z.object({
            userId: z.number().optional(),
            ledgerAccountId: z.number().optional(),
        }).refine(
            ({ userId, ledgerAccountId }) => userId !== undefined || ledgerAccountId !== undefined,
            'Enten bruker ID eller konto ID må være oppgitt.',
        ),
        operation: async ({ prisma, params }): Promise<ExpandedLedgerAccount> => {
            const account = await prisma.ledgerAccount.findFirstOrThrow({
                where: {
                    id: params.ledgerAccountId,
                    user: params.userId !== undefined ? { id: params.userId } : undefined,
                },
                include: {
                    groups: { select: { groupId: true } },
                },
            })

            return {
                ...account,
                groupIds: account.groups.map(group => group.groupId),
            }
        },
    }),

    /**
     * Reads all ledger accounts matching any of the given filters. An account is included if it
     * matches at least one of `ledgerAccountIds`, `userIds` or `groupIds`: this is a batch fetch
     * by several kinds of key, not a narrowing search, so the filters combine with OR, not AND.
     *
     * **Note**: The balance of the accounts are not included in the response.
     * Use the `calculateBalances` method to get the balances.
     *
     * @param params.ledgerAccountIds IDs of specific ledger accounts to include.
     * @param params.userIds IDs of users whose account should be included.
     * @param params.groupIds IDs of groups whose accounts should be included.
     *
     * @returns List of account details, without duplicates even when an account
     * matches more than one filter (e.g. it's shared by two requested groups).
     */
    readMany: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerAccountAuth.readMany.data({
            accounts: await resolveAccountsOwnership(prisma, params),
        }),
        paramsSchema: z.object({
            ledgerAccountIds: z.number().array().optional(),
            userIds: z.number().array().optional(),
            groupIds: z.number().array().optional(),
        }).refine(
            ({ ledgerAccountIds, userIds, groupIds }) =>
                Boolean(ledgerAccountIds?.length || userIds?.length || groupIds?.length),
            'Minst én av konto ID-er, bruker ID-er eller gruppe ID-er må være oppgitt.',
        ),
        operation: async ({ prisma, params }): Promise<LedgerAccount[]> => {
            const filters: Prisma.LedgerAccountWhereInput[] = []

            if (params.ledgerAccountIds?.length) {
                filters.push({ id: { in: params.ledgerAccountIds } })
            }
            if (params.userIds?.length) {
                filters.push({ user: { id: { in: params.userIds } } })
            }
            if (params.groupIds?.length) {
                filters.push({ groups: { some: { groupId: { in: params.groupIds } } } })
            }

            return await prisma.ledgerAccount.findMany({
                where: { OR: filters },
            })
        }
    }),

    readPage: defineOperation({
        authorizer: () => ledgerAccountAuth.readPage,
        paramsSchema: readPageInputSchemaObject(
            z.object({
                id: z.number(),
            }),
            z.object({
                accountType: z.nativeEnum(LedgerAccountType).optional(),
            }),
        ),
        operation: async ({ params: { paging }, prisma }): Promise<(LedgerAccount & { balance: Balance })[]> => {
            const accounts = await prisma.ledgerAccount.findMany({
                where: {
                    type: paging.details.accountType,
                },
                orderBy: [
                    { createdAt: 'desc' },
                    { id: 'desc' },
                ],
                ...cursorPagingSelection(paging.page),
            })

            const balances = accounts.length > 0
                ? await ledgerAccountOperations.calculateBalances({
                    params: { ledgerAccountIds: accounts.map(account => account.id) },
                })
                : {}

            return accounts.map(account => ({ ...account, balance: balances[account.id] }))
        }
    }),

    /**
     * Updates a ledger account with the given data.
     *
     * @param params.userId The ID of the user whose account to update.
     * @param params.ledgerAccountId The ID of the account to update.
     * @param data The data to update the account with.
     *
     * @returns The updated account.
     */
    update: defineOperation({
        authorizer: async ({ params, data, prisma }) => ledgerAccountAuth.update({
            accounts: [await resolveAccountOwnership(prisma, params)],
            changesGroupLinks: Boolean(data.addGroupIds?.length || data.removeGroupIds?.length),
        }),
        paramsSchema: z.object({
            userId: z.number().optional(),
            ledgerAccountId: z.number().optional(),
        }).refine(
            ({ userId, ledgerAccountId }) => userId !== undefined || ledgerAccountId !== undefined,
            'Enten bruker ID eller konto ID må være oppgitt.',
        ),
        dataSchema: ledgerAccountSchemas.update,
        operation: async ({ prisma, params, data }): Promise<LedgerAccount> => {
            const account = await ledgerAccountOperations.read({ params })
            const { addGroupIds, removeGroupIds, ...scalarData } = data

            return prisma.ledgerAccount.update({
                where: {
                    id: account.id,
                },
                data: {
                    ...scalarData,
                    // groups isn't a real field on the model. It's the groups relation, via the
                    // GroupLedgerAccount join table. deleteMany/createMany only touch the given
                    // group IDs, rather than replacing the whole relation, so that concurrent
                    // updates to different groups on the same account don't clobber each other.
                    ...((addGroupIds?.length || removeGroupIds?.length) && {
                        groups: {
                            ...(removeGroupIds?.length && {
                                deleteMany: { groupId: { in: removeGroupIds } },
                            }),
                            ...(addGroupIds?.length && {
                                createMany: {
                                    data: addGroupIds.map(groupId => ({ groupId })),
                                    skipDuplicates: true,
                                },
                            }),
                        },
                    }),
                },
            })
        }
    }),

    /**
     * Calculates the balance and fees of every ledger account matching any of the given filters.
     * Optionally takes a transaction ID to calculate the balance up until that transaction.
     *
     * @warning An account that does not exist is treated as having a balance of zero.
     *
     * @param params.ledgerAccountIds IDs of specific ledger accounts to include.
     * @param params.userIds IDs of users whose account should be included.
     * @param params.groupIds IDs of groups whose accounts should be included.
     * @param params.atTransactionId Optional transaction ID to calculate the balance up until that transaction.
     *
     * @returns The balances of the ledger accounts.
     */
    calculateBalances: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerAccountAuth.calculateBalances.data({
            accounts: await resolveAccountsOwnership(prisma, params),
        }),
        paramsSchema: z.object({
            ledgerAccountIds: z.number().array().optional(),
            userIds: z.number().array().optional(),
            groupIds: z.number().array().optional(),
            atTransactionId: z.number().optional(),
        }).refine(
            ({ ledgerAccountIds, userIds, groupIds }) =>
                Boolean(ledgerAccountIds?.length || userIds?.length || groupIds?.length),
            'Minst én av konto ID-er, bruker ID-er eller gruppe ID-er må være oppgitt.',
        ),
        operation: async ({ prisma, params }): Promise<BalanceRecord> => {
            // Skip resolving userIds/groupIds to ledger account IDs when ledgerAccountIds
            // alone was given, since there is then nothing to resolve.
            const ids = params.userIds?.length || params.groupIds?.length
                ? (await ledgerAccountOperations.readMany({
                    params: {
                        ledgerAccountIds: params.ledgerAccountIds,
                        userIds: params.userIds,
                        groupIds: params.groupIds,
                    },
                })).map(account => account.id)
                : params.ledgerAccountIds ?? []

            const balanceArray = await prisma.ledgerEntry.groupBy({
                by: ['ledgerAccountId'],
                where: {
                    // Select which accounts we want to calculate the balance for
                    ledgerAccountId: {
                        in: ids,
                    },
                    // Since transaction ids are sequential we can use the less than operator
                    // to filter for all the transactions that happened before the given one.
                    // This is useful in case we need to know the balance in the past.
                    ledgerTransactionId: {
                        lte: params.atTransactionId,
                    },
                    // Credit and debit ledger entries are valid under slight different conditions.
                    OR: [
                        {
                            // If the amount is greater than zero the entry is a credit (i.e. giving money).
                            funds: { gt: 0 },
                            // The receiver should (logically) only receive the money if the transaction succeeded.
                            ledgerTransaction: { state: 'SUCCEEDED' },
                        },
                        {
                            // If the amount is less than zero the entry is a debit (i.e. taking money).
                            funds: { lt: 0 },
                            // The amount should be deducted from the source if the transaction succeeded (obviously)
                            // OR when the transaction is pending. This is our way of reserving the funds
                            // until the transaction is complete.
                            ledgerTransaction: { state: { in: ['PENDING', 'SUCCEEDED'] } },
                        },
                    ],
                },
                // Select what fields we should sum
                _sum: {
                    funds: true,
                    fees: true,
                },
            })

            // Convert the array to an object as it's more convenient for lookups and
            // replace all nulls with zeros to handle accounts with no entries yet.
            // Set the balance of accounts that have no entries to zero.
            const balanceRecord = Object.fromEntries([
                ...ids.map(id => [id, { amount: 0, fees: 0 }]),
                ...balanceArray.map(balance => [
                    balance.ledgerAccountId,
                    {
                        amount: balance._sum.funds ?? 0,
                        fees: balance._sum.fees ?? 0
                    }
                ])
            ])

            return balanceRecord
        }
    }),

    /**
     * Calcultates the balance of a single account. Under the hood it simply uses `calculateBalances`.
     *
     * @param params.userId The ID of the user whose account to calculate the balance for.
     * @param params.ledgerAccountId The ID of the account to calculate the balance for.
     * @param params.atTransactionId Optional transaction ID to calculate the balance up until that transaction.
     *
     * @returns The balance of the ledger account.
     */
    calculateBalance: defineOperation({
        authorizer: async ({ params, prisma }) => ledgerAccountAuth.calculateBalance.data({
            accounts: [await resolveAccountOwnership(prisma, params)],
        }),
        paramsSchema: z.object({
            userId: z.number().optional(),
            ledgerAccountId: z.number().optional(),
            atTransactionId: z.number().optional(),
        }).refine(
            ({ userId, ledgerAccountId }) => userId !== undefined || ledgerAccountId !== undefined,
            'Enten bruker ID eller konto ID må være oppgitt.',
        ),
        operation: async ({ params }): Promise<Balance> => {
            const account = await ledgerAccountOperations.read({
                params: { userId: params.userId, ledgerAccountId: params.ledgerAccountId },
            })

            const balances = await ledgerAccountOperations.calculateBalances({
                params: {
                    ledgerAccountIds: [account.id],
                    atTransactionId: params.atTransactionId,
                },
            })

            return balances[account.id]
        }
    }),
} as const
