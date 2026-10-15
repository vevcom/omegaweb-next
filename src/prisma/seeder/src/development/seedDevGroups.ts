import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

const MANUAL_GROUP_COUNT = 10
const COMMITTEE_COUNT = 10

/** The dev committee with a ledger account of its own, which seedDevCabinLedgerAccount marks as the cabin account. */
export const DEV_COMMITTEE_SHORT_NAME = 'harcom'

export const seedDevGroups = defineSeedOperation(async (prisma: PrismaClient) => {
    const { order } = await prisma.omegaOrder.findFirstOrThrow({
        orderBy: {
            order: 'desc'
        },
    })

    await prisma.committee.upsert({
        where: { shortName: DEV_COMMITTEE_SHORT_NAME },
        update: {},
        create: {
            name: 'Harambes komité',
            shortName: DEV_COMMITTEE_SHORT_NAME,
            committeeArticle: {
                create: {
                    name: 'Harambes komité',
                    coverImage: {
                        create: {
                            name: 'Harambes bilde'
                        }
                    }
                }
            },
            paragraph: {
                create: {}
            },
            group: {
                create: {
                    groupType: 'COMMITTEE',
                    order,
                    ledgerAccounts: {
                        create: {
                            ledgerAccount: {
                                create: {
                                    type: 'GROUP',
                                    name: 'Kontoen til Harambes komité',
                                }
                            }
                        }
                    },
                },
            },
        },
    })

    // Dev seed data is keyed as dev_<service>_<index> so re-seeding can find-or-create it by its
    // unique short name.
    await Promise.all(Array.from({ length: MANUAL_GROUP_COUNT }).map((_, index) => prisma.manualGroup.upsert({
        where: { shortName: `dev_manual_groups_${index}` },
        update: {},
        create: {
            name: `dev_manual_groups_${index}`,
            shortName: `dev_manual_groups_${index}`,
            group: {
                create: {
                    groupType: 'MANUAL_GROUP',
                    order,
                },
            },
        }
    })))

    await Promise.all(Array.from({ length: COMMITTEE_COUNT }).map((_, index) => prisma.committee.upsert({
        where: { shortName: `dev_committees_${index}` },
        update: {},
        create: {
            name: `dev_committees_${index}`,
            shortName: `dev_committees_${index}`,
            committeeArticle: {
                create: {
                    name: `dev_committees_${index}`,
                    coverImage: {
                        create: {
                            name: `dev_committees_${index}`
                        }
                    }
                }
            },
            paragraph: {
                create: {}
            },
            group: {
                create: {
                    groupType: 'COMMITTEE',
                    order,
                },
            },
        }
    })))
})
