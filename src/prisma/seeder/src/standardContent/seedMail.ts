import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/**
 * Upserts the standard mail aliases (keyed on address) and mailing lists (keyed on name). An
 * existing mailing list is left untouched, including which aliases it holds - those are managed
 * through the admin pages, and an alias removed there should stay removed.
 */
export const seedMail = defineSeedOperation(async (prisma: PrismaClient) => {
    const DOMAIN = `@${process.env.EMAIL_DOMAIN}`

    const otherAliases = [
        'noreply',
    ]

    const mailingLists = [
        {
            name: 'VevCom',
            aliases: [
                'vevcom',
                'stripe',
            ],
        },
        {
            name: 'Hovedstyret',
            aliases: [
                'hs'
            ],
        },
        {
            name: 'Ombul',
            aliases: [
                'ombul',
            ],
        },
        {
            name: 'Bleast',
            aliases: [
                'bleast',
            ]
        },
        {
            name: 'Contactor',
            aliases: [
                'contactor',
            ]
        },
        {
            name: 'HeutteCom',
            aliases: [
                'heuttecommiteen',
                'heuttebooking',
            ]
        }
    ]

    const allAliases = mailingLists.map(mailingList => mailingList.aliases).flat().concat(otherAliases)

    await Promise.all(Array.from(new Set(allAliases)).map(alias => prisma.mailAlias.upsert({
        where: { address: alias + DOMAIN },
        update: {},
        create: { address: alias + DOMAIN },
    })))

    await Promise.all(mailingLists.map(mailingList => prisma.mailingList.upsert({
        where: { name: mailingList.name },
        update: {},
        create: {
            name: mailingList.name,
            mailAliases: {
                create: mailingList.aliases.map(alias => ({
                    mailAlias: { connect: { address: alias + DOMAIN } },
                })),
            },
        },
    })))
})
