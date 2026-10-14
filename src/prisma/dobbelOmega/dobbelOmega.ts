import migrateOmbul from './migrateOmbul'
import migrateImageCollections from './migrateImageCollections'
import migrateImages from './migrateImages'
import { getLimits } from './migrationLimits'
import migrateOmegaquotes from './migrateOmegaquotes'
import migrateNews from './migrateNews'
import migrateMailAliases from './migrateMailAlias'
import migrateEvents from './migrateEvents'
import { UserMigrator } from './migrateUsers'
import migrateCommittees from './migrateCommittees'
import migrateLockers from './migrateLockers'
import migratePrikks from './migratePrikks'
import migrateLedgerAccounts from './migrateLedgerAccounts'
import migrateLedgerTransactions from './migrateLedgerTransactions'
import seedProdPermissions from './seedProdPermissions'
import manifest from './manifest'
import { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'

/**
 * !DobbelOmega!
 * This function migrates data from OW basic to ProjectNext
 * @param pnPrisma - PrismaClientPn
 */
export default async function dobbelOmega(pnPrisma: PrismaClientPn) {
    manifest.info('')
    manifest.info('┌──────────────────────────────────┐')
    manifest.info('│           Dobbel Omega           │')
    manifest.info('└──────────────────────────────────┘')
    const owPrisma = new PrismaClientOw({
        adapter: new PrismaPg({
            connectionString: process.env.OW_DB_URI,
        }),
    })

    const limits = getLimits()

    const imageCollectionIdMap = await migrateImageCollections(pnPrisma, owPrisma)
    const imageIdMap = await migrateImages(pnPrisma, owPrisma, imageCollectionIdMap, limits)

    const userMigrator = new UserMigrator(pnPrisma, owPrisma, imageIdMap)
    await userMigrator.initSpecialGroups()
    await userMigrator.migrateUsers(limits)

    // Committees run before the steps that reference them: a committee's group is what
    // committee-only news is made visible to and what a committee-held locker is
    // reserved by, so the map has to exist before either of those is written.
    const committeeGroupIdMap = await migrateCommittees(pnPrisma, owPrisma, userMigrator, imageIdMap)

    await migrateOmbul(pnPrisma, owPrisma, imageIdMap, limits)
    await migrateOmegaquotes(pnPrisma, owPrisma, userMigrator, limits)
    await migrateNews(
        pnPrisma,
        owPrisma,
        { images: imageIdMap, committeeGroups: committeeGroupIdMap },
        userMigrator,
        limits,
    )
    await migrateMailAliases(pnPrisma, owPrisma, limits)
    const eventRegistrationIdMap = await migrateEvents(pnPrisma, owPrisma, imageIdMap, userMigrator, limits)
    await migratePrikks(pnPrisma, owPrisma, userMigrator, limits)
    await migrateLockers(pnPrisma, owPrisma, userMigrator, committeeGroupIdMap, limits)

    const { userAccountIdMap, drainAccountIdMap, legacySuspenseAccountId } = await migrateLedgerAccounts(
        pnPrisma, owPrisma, userMigrator, committeeGroupIdMap
    )
    await migrateLedgerTransactions({
        pnPrisma, owPrisma, userAccountIdMap, drainAccountIdMap, eventRegistrationIdMap, legacySuspenseAccountId, limits
    })

    await seedProdPermissions(pnPrisma)

    owPrisma.$disconnect()
    manifest.info('┌──────────────────────────────────┐')
    manifest.info('│ Dobbel Omega ferdig, dagen derpå │')
    manifest.info('└──────────────────────────────────┘')
}
