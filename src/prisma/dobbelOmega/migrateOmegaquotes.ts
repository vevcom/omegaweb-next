import { createProgressBar } from './progressBar'
import manifest from './manifest'
import type { UserMigrator } from './migrateUsers'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { Limits } from './migrationLimits'

/**
 * This function migrates omegaquotes from Omegaweb-basic to PN
 * @param pnPrisma - PrismaClientPn
 * @param owPrisma - PrismaClientOw
 * @param limits - Limits - used to limit the number of quotes to migrate
 */
export default async function migrateOmegaquotes(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    userMigrator: UserMigrator,
    limits: Limits
) {
    const omegaquotes = await owPrisma.quotes.findMany({
        take: limits.omegaquotes ? limits.omegaquotes : undefined,
    })

    // Remove all quotes without a PosterId.
    // There exists no quotes without a PosterId in the database, except three tests
    const omegaquotesWithPosterId = omegaquotes.filter(quote => quote.PosterId)
    const data: {
        quote: string
        author: string
        timestamp: Date
        userPosterId: number
    }[] = []

    const bar = createProgressBar('Migrating omegaquotes', omegaquotesWithPosterId.length)
    for (const quote of omegaquotesWithPosterId) {
        if (!quote.PosterId) {
            bar.increment()
            continue
        }

        const pnPosterId = await userMigrator.getPnUserId(quote.PosterId)
        if (!pnPosterId) {
            manifest.error(`Failed to migrate omegaquote ${quote.id} because no user with id ${quote.PosterId} exists`)
            bar.increment()
            continue
        }

        data.push({
            quote: quote.quote,
            author: quote.author,
            timestamp: quote.timestamp || new Date(),
            userPosterId: pnPosterId,
        })
        bar.increment()
    }
    bar.stop()

    await pnPrisma.omegaQuote.createMany({
        data
    })

    //TODO: also seed bulshit into omegaquote
}
