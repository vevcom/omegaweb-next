import { Zpn } from '@/lib/fields/zpn'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { LedgerAccountType } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const fieldSchemas = z.object({
    // Display name for the account. Only meaningful for GROUP accounts (see LedgerAccount.name).
    name: z.string().optional(),
    payoutAccountNumber: z.string().optional(),
    frozen: z.boolean(),
    addGroupIds: z.number().array().optional(),
    removeGroupIds: z.number().array().optional(),
    userId: z.number().optional(),
    ledgerAccountId: z.number().optional(),
    atTransactionId: z.number().optional(),
    ledgerAccountIds: z.number().array().optional(),
    userIds: z.number().array().optional(),
    groupIds: z.number().array().optional(),
    accountType: z.nativeEnum(LedgerAccountType).optional(),
    includeGroupAccounts: z.boolean(),
    includeUserAccounts: z.boolean(),
})

export const ledgerAccountSchemas = {
    create: fieldSchemas.partial().pick({
        name: true,
        payoutAccountNumber: true,
        frozen: true,
    }).extend({
        groupIds: Zpn.numberListCheckboxFriendly({ label: 'Grupper' }).optional(),
    }),

    update: fieldSchemas.partial().pick({
        name: true,
        payoutAccountNumber: true,
        frozen: true,
        addGroupIds: true,
        removeGroupIds: true,
    }),
}

const oneAccountRefinement = [
    ({ userId, ledgerAccountId }: { userId?: number, ledgerAccountId?: number }) =>
        userId !== undefined || ledgerAccountId !== undefined,
    'Enten bruker ID eller konto ID må være oppgitt.',
] as const

const manyAccountsRefinement = [
    ({ ledgerAccountIds, userIds, groupIds }: { ledgerAccountIds?: number[], userIds?: number[], groupIds?: number[] }) =>
        Boolean(ledgerAccountIds?.length || userIds?.length || groupIds?.length),
    'Minst én av konto ID-er, bruker ID-er eller gruppe ID-er må være oppgitt.',
] as const

/** One account, by its own id or by the user it belongs to. */
const oneAccount = fieldSchemas.pick({
    userId: true,
    ledgerAccountId: true,
}).refine(...oneAccountRefinement)

/** Several accounts, by any of their ids, their users' ids or their groups' ids. */
const manyAccounts = fieldSchemas.pick({
    ledgerAccountIds: true,
    userIds: true,
    groupIds: true,
}).refine(...manyAccountsRefinement)

export const ledgerAccountParamsSchemas = {
    read: oneAccount,
    readMany: manyAccounts,
    readAccessible: fieldSchemas.pick({
        includeGroupAccounts: true,
        includeUserAccounts: true,
    }),
    readPage: readPageInputSchemaObject(
        z.object({
            id: z.number(),
        }),
        fieldSchemas.pick({
            accountType: true,
        }),
    ),
    update: oneAccount,
    calculateBalances: fieldSchemas.pick({
        ledgerAccountIds: true,
        userIds: true,
        groupIds: true,
        atTransactionId: true,
    }).refine(...manyAccountsRefinement),
    calculateBalance: fieldSchemas.pick({
        userId: true,
        ledgerAccountId: true,
        atTransactionId: true,
    }).refine(...oneAccountRefinement),
}
