import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { Zpn } from '@/lib/fields/zpn'
import { LedgerAccountType } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    // Display name for the account. Only meaningful for GROUP accounts (see LedgerAccount.name).
    name: z.string().optional(),
    groupIds: Zpn.numberListCheckboxFriendly({ label: 'Grupper' }).optional(),
    payoutAccountNumber: z.string().optional(),
    frozen: z.boolean(),
    addGroupIds: z.number().array().optional(),
    removeGroupIds: z.number().array().optional(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    userId: z.number().optional(),
    ledgerAccountId: z.number().optional(),
    ledgerAccountIds: z.number().array().optional(),
    userIds: z.number().array().optional(),
    groupIds: z.number().array().optional(),
    accountType: z.nativeEnum(LedgerAccountType).optional(),
    includeGroupAccounts: z.boolean(),
    includeUserAccounts: z.boolean(),
})

/** One account is identified by its own id or by its owning user. */
const oneAccountKey = [
    ({ userId, ledgerAccountId }: { userId?: number, ledgerAccountId?: number }) =>
        userId !== undefined || ledgerAccountId !== undefined,
    'Enten bruker ID eller konto ID må være oppgitt.',
] as const

/** A batch of accounts needs at least one non-empty id list to match against. */
const atLeastOneIdList = [
    ({ ledgerAccountIds, userIds, groupIds }: { ledgerAccountIds?: number[], userIds?: number[], groupIds?: number[] }) =>
        Boolean(ledgerAccountIds?.length || userIds?.length || groupIds?.length),
    'Minst én av konto ID-er, bruker ID-er eller gruppe ID-er må være oppgitt.',
] as const

const account = paramsFieldSchemas.pick({
    userId: true,
    ledgerAccountId: true,
}).refine(...oneAccountKey)

export const ledgerAccountSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            groupIds: true,
            payoutAccountNumber: true,
            frozen: true,
        }).partial(),
        // An owner may rename their account, set its payout number, and freeze it (stop its own
        // spending) - but never unfreeze it or change its group links themselves, see
        // updateAsAdmin. frozen is narrowed to the literal true so that's enforced by the schema
        // itself, not a runtime check: this operation cannot even express an unfreeze attempt.
        update: dataFieldSchemas.pick({
            name: true,
            payoutAccountNumber: true,
        }).extend({
            frozen: z.literal(true).optional(),
        }).partial(),
        updateAsAdmin: dataFieldSchemas.pick({
            frozen: true,
            addGroupIds: true,
            removeGroupIds: true,
        }).partial(),
    },
    params: {
        read: account,
        readMany: paramsFieldSchemas.pick({
            ledgerAccountIds: true,
            userIds: true,
            groupIds: true,
        }).refine(...atLeastOneIdList),
        readAccessible: paramsFieldSchemas.pick({
            includeGroupAccounts: true,
            includeUserAccounts: true,
        }),
        readPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            paramsFieldSchemas.pick({
                accountType: true,
            }),
        ),
        update: account,
        updateAsAdmin: account,
        calculateBalances: paramsFieldSchemas.pick({
            ledgerAccountIds: true,
            userIds: true,
            groupIds: true,
        }).refine(...atLeastOneIdList),
        calculateBalance: paramsFieldSchemas.pick({
            userId: true,
            ledgerAccountId: true,
        }).refine(...oneAccountKey),
    },
}
