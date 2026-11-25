import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import type { PrismaClient } from '@/prisma-generated-pn-client'

/** A visibility no one passes, so the alias or list is the mail server admins' alone until they hand it over. */
const ownedByNoOne = { create: { requirements: { create: [{}] } } }

/**
 * Upserts the standard mail aliases (keyed on address) and mailing lists (keyed on name). An
 * existing mailing list is left untouched, including which aliases it holds - those are managed
 * through the admin pages, and an alias removed there should stay removed.
 */
export const seedMail = defineSeedOperation(async (prisma: PrismaClient) => {
    const DOMAIN = `@${DomainContext.mailDomainOf(Site.root)}`

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
        create: { mailAddress: { create: { address: alias + DOMAIN } }, ownerVisibility: ownedByNoOne },
    })))

    await Promise.all(mailingLists.map(mailingList => prisma.mailingList.upsert({
        where: { name: mailingList.name },
        update: {},
        create: {
            name: mailingList.name,
            ownerVisibility: ownedByNoOne,
            mailAliases: {
                create: mailingList.aliases.map(alias => ({
                    mailAlias: { connect: { address: alias + DOMAIN } },
                })),
            },
        },
    })))
})
