import { createProgressBar } from './progressBar'
import { resyncIdSequence } from './resyncIdSequence'
import logger from '@/lib/logger'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { UserMigrator } from './migrateUsers'
import type { Limits } from './migrationLimits'

/**
 * Migrates Omegaweb-basic Prikks to PN Dots. The two models line up field for field
 * (reason, value, the accused and the accuser), so this is a straight copy.
 *
 * Nothing but this migration writes Dots, so the Omegaweb-basic id carries over as the PN
 * id - that is what lets a second run tell what it already imported instead of handing
 * everyone their prikks twice. The sequence is resynced afterwards so dots handed out on
 * the new site do not collide with a migrated id.
 *
 * A prikk whose accuser is gone from Omegaweb-basic is skipped: PN requires an accuser,
 * and the honest options are to drop the row or to blame someone who did not give it.
 * @param pnPrisma - PrismaClientPn
 * @param owPrisma - PrismaClientOw
 * @param userMigrator - resolves (and migrates on demand) the users a prikk points at
 * @param limits - Limits - used to limit the number of prikks to migrate
 */
export default async function migratePrikks(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    userMigrator: UserMigrator,
    limits: Limits,
) {
    const allPrikks = await owPrisma.prikks.findMany({
        take: limits.prikks ? limits.prikks : undefined,
    })

    const alreadyMigrated = new Set((await pnPrisma.dot.findMany({
        where: { id: { in: allPrikks.map(prikk => prikk.id) } },
        select: { id: true },
    })).map(dot => dot.id))

    const prikks = allPrikks.filter(prikk => !alreadyMigrated.has(prikk.id))

    const withoutAccuser = prikks.filter(prikk => prikk.AccuserId === null)
    if (withoutAccuser.length) {
        logger.warn(
            `${withoutAccuser.length} prikk(s) have no accuser in Omegaweb-basic and cannot be `
            + 'migrated, since PN requires one. Skipping them.'
        )
    }

    const migratable = prikks.filter(prikk => prikk.AccuserId !== null)

    const bar = createProgressBar('Migrating prikks', migratable.length)
    for (const prikk of migratable) {
        // Sequential rather than Promise.all: getPnUserId migrates a missing user on
        // demand, and the prikk archive points at far more users than the user step
        // itself brings over when limits are on.
        const userId = await userMigrator.getPnUserId(prikk.AccusedId)
        const accuserId = await userMigrator.getPnUserId(prikk.AccuserId as number)

        await pnPrisma.dot.create({
            data: {
                id: prikk.id,
                userId,
                accuserId,
                reason: prikk.reason,
                value: prikk.prikkValue,
                createdAt: prikk.createdAt,
                updatedAt: prikk.updatedAt,
            }
        })

        bar.increment()
    }
    bar.stop()

    await resyncIdSequence(pnPrisma, 'Dot')
}
