import { owIdToPnId, type IdMapper } from './IdMapper'
import manifest from '@/prisma/seeder/src/dobbelOmega/manifest'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { UserMigrator } from './migrateUsers'

const legacySuspenseAccountName = 'Legacy (OmegaWeb Basic)'

/**
 * Migrates OW MoneySourceAccounts ("user accounts") and MoneyDrainAccounts ("group accounts")
 * to native ledger accounts, plus creates a dedicated suspense account used by
 * migrateLedgerTransactions whenever a transaction's real OW counterparty (drain account,
 * commodity, event registration) can't be resolved - this keeps every migrated transaction
 * balanced (double-entry) instead of being dropped.
 *
 * @returns userAccountIdMap - OW MoneySourceAccounts.id -> PN LedgerAccount.id
 * @returns drainAccountIdMap - OW MoneyDrainAccounts.id -> PN LedgerAccount.id
 * @returns legacySuspenseAccountId - PN LedgerAccount.id of the dedicated suspense account
 */
export default async function migrateLedgerAccounts(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    userMigrator: UserMigrator,
    committeeGroupIdMap: IdMapper,
) {
    const sourceAccounts = await owPrisma.moneySourceAccounts.findMany()

    const userAccountIdMap: IdMapper = await Promise.all(sourceAccounts.map(async account => {
        const userId = await userMigrator.getPnUserId(account.UserId)

        if (account.stripeCustomerId) {
            await pnPrisma.stripeCustomer.upsert({
                where: { userId },
                update: { customerId: account.stripeCustomerId },
                create: { userId, customerId: account.stripeCustomerId },
            })
        }
        // TODO: MoneySourceAccounts.stripePaymentMethodId/stripeCardDescription have no
        // equivalent field on the new schema yet - not migrated.

        const { ledgerAccountId } = await pnPrisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { ledgerAccountId: true },
        })

        const ledgerAccount = await pnPrisma.ledgerAccount.update({
            where: { id: ledgerAccountId },
            data: {
                frozen: account.disabled ?? false,
            },
        })

        return { owId: account.id, pnId: ledgerAccount.id }
    }))

    const drainAccounts = await owPrisma.moneyDrainAccounts.findMany({
        include: {
            SpecialRoles: true,
        },
    })

    const drainAccountIdMap: IdMapper = await Promise.all(drainAccounts.map(async account => {
        const committeeId = account.SpecialRoles?.CommitteeId ?? null
        const groupId = owIdToPnId(committeeGroupIdMap, committeeId, 'committees')

        if (account.SpecialRoleId && !groupId) {
            manifest.info(
                `Drain account ${account.id} (${account.name}) could not be linked to a migrated ` +
                'committee/group - creating it unlinked.'
            )
        }

        const ledgerAccount = await pnPrisma.ledgerAccount.create({
            data: {
                type: 'GROUP',
                name: account.name,
                payoutAccountNumber: account.accountNumber,
                frozen: !account.active,
                groups: groupId ? {
                    create: {
                        groupId,
                    },
                } : undefined,
            },
        })

        return { owId: account.id, pnId: ledgerAccount.id }
    }))

    const legacySuspenseAccount = await pnPrisma.ledgerAccount.create({
        data: {
            type: 'GROUP',
            name: legacySuspenseAccountName,
        },
    })

    return {
        userAccountIdMap,
        drainAccountIdMap,
        legacySuspenseAccountId: legacySuspenseAccount.id,
    }
}
