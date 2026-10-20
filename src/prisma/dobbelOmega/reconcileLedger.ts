import manifest from './manifest'
import { owIdToPnId, type IdMapper, type MappedResource } from './IdMapper'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { Limits } from './migrationLimits'

type ReconcileContext = {
    pnPrisma: PrismaClientPn
    owPrisma: PrismaClientOw
    userAccountIdMap: IdMapper
    drainAccountIdMap: IdMapper
    limits: Limits
}

// Postgres sums come back as bigint, or null when nothing was summed.
type OwSum = bigint | number | null

/**
 * Compares migrated ledger balances with the balances OW's own queries give, and logs every
 * account that differs. Group accounts are compared on amount minus fees, since OW stores a
 * group's balance net of the fees it has repaid.
 */
export default async function reconcileLedger(
    { pnPrisma, owPrisma, userAccountIdMap, drainAccountIdMap, limits }: ReconcileContext
) {
    if (limits.moneyDeposits || limits.moneyPayments || limits.moneyTransfers) {
        manifest.info('Ledger reconciliation skipped, since money migration limits leave out rows on purpose.')
        return
    }

    // The OW balance queries are taken from scripts/sourcebalance.sql and scripts/drainbalance.sql.
    const [userBalances, userFees, drainBalances] = await Promise.all([
        owPrisma.$queryRaw<{ id: number, balance: OwSum }[]>`
            SELECT "MoneySourceAccounts"."id" AS "id",
                coalesce("instr", 0) + coalesce("inman", 0) - coalesce("out", 0) AS "balance"
            FROM "MoneySourceAccounts"
            LEFT OUTER JOIN
            (SELECT "MoneySourceAccountId", sum("amount") AS "inman"
                FROM "MoneyManualDeposits" GROUP BY "MoneyManualDeposits"."MoneySourceAccountId") AS "manual"
                ON "manual"."MoneySourceAccountId" = "MoneySourceAccounts"."id"
            LEFT OUTER JOIN
            (SELECT "MoneySourceAccountId", sum("amount") AS "instr"
                FROM "MoneyStripeDeposits" WHERE "MoneyStripeDeposits"."status" = 'successful'
                GROUP BY "MoneyStripeDeposits"."MoneySourceAccountId") AS "stripe"
                ON "stripe"."MoneySourceAccountId" = "MoneySourceAccounts"."id"
            LEFT OUTER JOIN
            (SELECT "MoneySourceAccountId", sum("MoneyCommodities"."price") AS "out"
                FROM "MoneyPayments" INNER JOIN "MoneyCommodities"
                ON "MoneyPayments"."MoneyCommodityId" = "MoneyCommodities"."id"
                GROUP BY "MoneyPayments"."MoneySourceAccountId") AS "payments"
                ON "payments"."MoneySourceAccountId" = "MoneySourceAccounts"."id"`,
        owPrisma.$queryRaw<{ id: number, unpaidFees: OwSum }[]>`
            SELECT "id", coalesce("feein", 0) - coalesce("feeout", 0) AS "unpaidFees"
            FROM "MoneySourceAccounts"
            LEFT OUTER JOIN
            (SELECT "MoneySourceAccountId", sum("fees") AS "feein"
                FROM "MoneyStripeDeposits" WHERE "MoneyStripeDeposits"."status" = 'successful'
                GROUP BY "MoneyStripeDeposits"."MoneySourceAccountId") AS "stripe"
                ON "stripe"."MoneySourceAccountId" = "MoneySourceAccounts"."id"
            LEFT OUTER JOIN
            (SELECT "MoneySourceAccountId", sum("repaidFees") AS "feeout"
                FROM "MoneyPayments" GROUP BY "MoneyPayments"."MoneySourceAccountId") AS "payments"
                ON "payments"."MoneySourceAccountId" = "MoneySourceAccounts"."id"`,
        owPrisma.$queryRaw<{ id: number, balance: OwSum }[]>`
            SELECT "id", coalesce("pay", 0) - coalesce("transf", 0) - coalesce("fees", 0) AS "balance"
            FROM "MoneyDrainAccounts"
            LEFT OUTER JOIN
            (SELECT "MoneyDrainAccountId", sum("price") AS "pay",
                sum("MoneyPayments"."repaidFees") AS "fees"
                FROM "MoneyCommodities" INNER JOIN "MoneyPayments"
                ON "MoneyPayments"."MoneyCommodityId" = "MoneyCommodities"."id"
                GROUP BY "MoneyCommodities"."MoneyDrainAccountId") AS "payments"
                ON "payments"."MoneyDrainAccountId" = "MoneyDrainAccounts"."id"
            LEFT OUTER JOIN
            (SELECT "MoneyDrainAccountId", sum("amount") AS "transf"
                FROM "MoneyTransfers" GROUP BY "MoneyTransfers"."MoneyDrainAccountId") AS "transfers"
                ON "transfers"."MoneyDrainAccountId" = "MoneyDrainAccounts"."id"`,
    ])

    const toPnIds = (mapper: IdMapper, resource: MappedResource) =>
        new Map(mapper.flatMap(({ owId }) => {
            const pnId = owIdToPnId(mapper, owId, resource)
            return pnId ? [[owId, pnId] as const] : []
        }))
    const userPnIds = toPnIds(userAccountIdMap, 'user accounts')
    const drainPnIds = toPnIds(drainAccountIdMap, 'drain accounts')

    const balances = await ledgerAccountOperations.internal.calculateBalances.internalCall({
        params: { ledgerAccountIds: [...Array.from(userPnIds.values()), ...Array.from(drainPnIds.values())] },
        prisma: pnPrisma,
    })

    let mismatches = 0
    const check = (label: string, owId: number, pnId: number | undefined, expected: OwSum, actual: number) => {
        if (pnId === undefined) {
            manifest.error(`Reconciliation: ${label} for OW account ${owId} has no migrated ledger account.`)
            mismatches++
            return
        }
        if (Number(expected ?? 0) === actual) return
        manifest.error(
            `Reconciliation: ${label} of OW account ${owId} (ledger account ${pnId}) ` +
            `is ${actual}, but OW has ${Number(expected ?? 0)}.`
        )
        mismatches++
    }

    for (const { id, balance } of userBalances) {
        const pnId = userPnIds.get(id)
        check('user balance', id, pnId, balance, pnId ? balances[pnId]?.amount ?? 0 : 0)
    }
    for (const { id, unpaidFees } of userFees) {
        const pnId = userPnIds.get(id)
        check('user fees', id, pnId, unpaidFees, pnId ? balances[pnId]?.fees ?? 0 : 0)
    }
    for (const { id, balance } of drainBalances) {
        const pnId = drainPnIds.get(id)
        const pnBalance = pnId ? balances[pnId] : undefined
        check('group balance net of fees', id, pnId, balance, (pnBalance?.amount ?? 0) - (pnBalance?.fees ?? 0))
        if (pnId && (pnBalance?.fees ?? 0) < 0) {
            manifest.error(`Reconciliation: group ledger account ${pnId} has negative fees ${pnBalance?.fees}.`)
            mismatches++
        }
    }

    manifest.info(
        `Ledger reconciliation checked ${userBalances.length} user and ${drainBalances.length} group accounts ` +
        `and found ${mismatches} mismatches.`
    )
}
