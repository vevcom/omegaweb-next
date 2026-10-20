import { createProgressBar } from './progressBar'
import { resyncIdSequence } from './resyncIdSequence'
import logger from '@/lib/logger'
import type { PrismaClient as PrismaClientPn } from '@/prisma-generated-pn-client'
import type { PrismaClient as PrismaClientOw } from '@/prisma-generated-ow-basic/client'
import type { Limits } from './migrationLimits'


export default async function migrateMailAliases(
    pnPrisma: PrismaClientPn,
    owPrisma: PrismaClientOw,
    limits: Limits,
) {
    if (limits.mailaliases === 0) return
    const aliases = await owPrisma.mailAliases.findMany({
        take: limits.mailaliases ?? undefined,
        include: {
            ExtraAliasMembers: true,
        }
    })

    // Aliases a notification channel points at must survive - that FK restricts.
    await pnPrisma.$executeRaw`
        DELETE FROM "MailAlias"
        WHERE NOT EXISTS (
            SELECT 1 FROM "NotificationChannel"
            WHERE "NotificationChannel"."mailAliasId" = "MailAlias"."id"
        )
    `
    await pnPrisma.mailingList.deleteMany()
    await pnPrisma.mailAddressExternal.deleteMany()

    await pnPrisma.mailAlias.createMany({
        data: aliases.map(a => ({
            address: a.address,
            description: a.name,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
        })),
        skipDuplicates: true,
    })


    const mailingListBar = createProgressBar('Migrating mailing lists', aliases.length)
    // try/finally so a failing create still releases the bar - an abandoned
    // cli-progress bar leaves the terminal without its cursor.
    try {
        await Promise.all(aliases.map(a => pnPrisma.mailingList.create({
            data: {
                name: a.name,
                id: a.id,
                createdAt: a.createdAt,
                updatedAt: a.updatedAt,
                mailAliases: {
                    create: {
                        mailAlias: {
                            connect: {
                                address: a.address,
                            }
                        }
                    }
                }
            }
        }).finally(() => mailingListBar.increment())))
    } finally {
        mailingListBar.stop()
    }

    await resyncIdSequence(pnPrisma, 'MailingList')

    const omegaFilter = (a: typeof externalAdrs[number]) => a.address.trim().endsWith('@omega.ntnu.no')
    const studNtnuFilter = (a: typeof externalAdrs[number]) => a.address.trim().endsWith('@stud.ntnu.no')

    const externalAdrs = aliases.map(a => a.ExtraAliasMembers.map(e => ({
        address: e.address,
        id: a.id,
    }))).flat()

    const alredyAdded = new Set<string>()

    const externalAdrsBar = createProgressBar('Migrating external addresses', externalAdrs.length)
    for (const a of externalAdrs) {
        if (omegaFilter(a) || studNtnuFilter(a)) {
            externalAdrsBar.increment()
            continue
        }

        if (!alredyAdded.has(a.address)) {
            await pnPrisma.mailAddressExternal.create({
                data: {
                    address: a.address,
                    mailingLists: {
                        create: {
                            mailingList: {
                                connect: {
                                    id: a.id,
                                }
                            }
                        }
                    }
                }
            })
            alredyAdded.add(a.address)
        } else {
            await pnPrisma.mailingListMailAddressExternal.create({
                data: {
                    mailingList: {
                        connect: {
                            id: a.id,
                        }
                    },
                    mailAddressExternal: {
                        connect: {
                            address: a.address,
                        }
                    }
                }
            })
        }
        externalAdrsBar.increment()
    }
    externalAdrsBar.stop()

    const omegaForward: {address: string, id: number}[] = []

    const searchRecusive = (address: string, alias: typeof aliases[number]) => {
        omegaForward.push({
            address,
            id: alias.id,
        })

        alias.ExtraAliasMembers.forEach(a => {
            const sAlias = aliases.find(b => b.address === a.address)
            if (sAlias) {
                searchRecusive(address, sAlias)
            }
        })
    }

    externalAdrs.filter(omegaFilter).forEach(a => {
        const alias = aliases.find(b => b.address === a.address)
        if (alias) {
            searchRecusive(a.address, alias)
        }
    })

    const omegaForwardBar = createProgressBar('Migrating omega forwards', omegaForward.length)
    for (const a of omegaForward) {
        try {
            await pnPrisma.mailAliasMailingList.create({
                data: {
                    mailAlias: {
                        connect: {
                            address: a.address,
                        },
                    },
                    mailingList: {
                        connect: {
                            id: a.id,
                        }
                    }
                }
            })
        } catch (e) {
            logger.error(
                `Encountered error when migrating mail alias with ID ${a.id} and address '${a.address}'.`,
                { error: e, alias: a },
            )
        }
        omegaForwardBar.increment()
    }
    omegaForwardBar.stop()
}
