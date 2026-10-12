import { allNotificationMethodsOff, allNotificationMethodsOn } from '@/services/notifications/constants'
import { SpecialNotificationChannel } from '@/prisma-generated-pn-types'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { upsert } from '@/seeder/src/upsert'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { NotificationMethod } from '@/prisma-generated-pn-types'

type ChannelInfo = {
    special?: SpecialNotificationChannel
    name: string
    description: string
    defaultMethods: Omit<NotificationMethod, 'id'>
    availableMethods: Omit<NotificationMethod, 'id'>
    alias?: string
}

/**
 * Upserts the notification channels, keyed on special for the special channels and on the unique
 * name for the rest. An existing channel is left untouched - its methods, alias and description are
 * edited through the admin pages.
 */
export const seedNotificationChannels = defineSeedOperation(async (prisma: PrismaClient) => {
    const specialKeys = new Set(Object.keys(SpecialNotificationChannel) as SpecialNotificationChannel[])

    const channels: ChannelInfo[] = [
        {
            special: 'ROOT',
            name: 'Alle varslinger',
            description: 'Denne kanalen styrer alle varslinger',
            defaultMethods: allNotificationMethodsOn,
            availableMethods: allNotificationMethodsOn,
        },
        {
            special: 'NEW_EVENT',
            name: 'Nytt arrangement',
            description: 'Varslinger om nye arrangementer',
            defaultMethods: {
                email: false,
                emailWeekly: true,
            },
            availableMethods: allNotificationMethodsOn,
        },
        {
            special: 'NEW_OMBUL',
            name: 'Ny ombul',
            description: 'Varsling når det kommer ny ombul',
            defaultMethods: allNotificationMethodsOff,
            availableMethods: allNotificationMethodsOn,
        },
        {
            special: 'NEW_NEWS_ARTICLE',
            name: 'Ny nyhetsartikkel',
            description: 'Varslinger om nye artikler',
            defaultMethods: allNotificationMethodsOff,
            availableMethods: allNotificationMethodsOn,
        },
        {
            special: 'NEW_JOBAD',
            name: 'Ny jobbannonse',
            description: 'Varslinger at en ny jobbanonse er ute',
            defaultMethods: {
                email: false,
                emailWeekly: true,
            },
            availableMethods: allNotificationMethodsOn,
        },
        {
            special: 'NEW_OMEGAQUOTE',
            name: 'Ny omegaquote',
            description: 'Varslinger om en ny omega quote',
            defaultMethods: allNotificationMethodsOff,
            availableMethods: allNotificationMethodsOn,
        },
        {
            special: 'EVENT_WAITINGLIST_PROMOTION',
            name: 'Venteliste opprykk',
            description: 'Varsling ved opprykk fra venteliste',
            defaultMethods: {
                email: true,
                emailWeekly: false,
            },
            availableMethods: {
                email: true,
                emailWeekly: false,
            },
        },
        {
            special: 'CABIN_BOOKING_CONFIRMATION',
            name: 'Bekreftelse på heuttebooking',
            description: 'Få en mail som bekreftelse på at du har booka heutta',
            defaultMethods: {
                email: true,
                emailWeekly: false,
            },
            availableMethods: {
                email: true,
                emailWeekly: false,
            },
            alias: 'heuttebooking'
        },
        {
            name: 'Informasjon fra HS',
            description: 'Varsling når Hovedstyret vil gi ut informasjon',
            defaultMethods: {
                email: true,
                emailWeekly: false,
            },
            availableMethods: allNotificationMethodsOn,
            alias: 'hs',
        },
        {
            name: 'Merch',
            description: 'Her kommer det varslinger om Omega Merch fra Blaest-Com',
            defaultMethods: {
                email: true,
                emailWeekly: false,
            },
            availableMethods: allNotificationMethodsOn,
            alias: 'bleast',
        },
        {
            name: 'Driftsstatus',
            description: 'Her kommer det varslinger dersom noe på veven ikke funnker, eller ved planlagt vedlikehld',
            defaultMethods: {
                email: true,
                emailWeekly: false,
            },
            availableMethods: allNotificationMethodsOn,
            alias: 'vevcom',
        },
        {
            name: 'Contactor',
            description: 'Her kommer det diverse informasjon fra contactor',
            defaultMethods: {
                email: true,
                emailWeekly: false,
            },
            availableMethods: allNotificationMethodsOn,
            alias: 'contactor',
        },
        {
            name: 'Mat på Gløshaugen',
            description: `Her kommer informasjon om når det er vafler på Lophtet eller 
                          noe annen mat i området rundt El-bygget`,
            defaultMethods: {
                email: true,
                emailWeekly: false,
            },
            availableMethods: {
                email: true,
                emailWeekly: false,
            },
        },
        {
            name: 'Diverse',
            description: 'Her kommer informasjon som ellers ikke passer inn i kategoriene',
            defaultMethods: {
                email: true,
                emailWeekly: false,
            },
            availableMethods: allNotificationMethodsOn,
        },
    ]

    channels.forEach(channel => {
        if (channel.special) {
            if (!specialKeys.has(channel.special)) {
                throw new Error(
                    `The seeding data is not valid. The special key: ${channel.special} is duplicate or not valid.`
                )
            }
            specialKeys.delete(channel.special)
        }
    })

    if (specialKeys.size) {
        throw new Error(
            `Not all special keys are present in the seeding data. Missing: ${Array.from(specialKeys).join(', ')}`
        )
    }

    const DEFAULT_NOTIFCIATION_ALIAS = `noreply@${process.env.EMAIL_DOMAIN}`

    const rChan = channels.find(channel => channel.special === 'ROOT')

    if (!rChan) {
        throw new Error('No ROOT channel found')
    }

    await upsert({
        checkExistence: () => prisma.notificationChannel.findUnique({
            where: { special: 'ROOT' },
            select: { id: true },
        }),
        create: () => createRootChannel(prisma, rChan, DEFAULT_NOTIFCIATION_ALIAS),
        update: () => Promise.resolve(),
    })

    await Promise.all(channels
        .filter(channel => channel.special !== 'ROOT')
        .map(channel => prisma.notificationChannel.upsert({
            where: channel.special ? { special: channel.special } : { name: channel.name },
            update: {},
            create: {
                name: channel.name,
                description: channel.description,
                availableMethods: {
                    create: channel.availableMethods,
                },
                defaultMethods: {
                    create: channel.defaultMethods,
                },
                special: channel.special,
                parent: {
                    connect: {
                        special: 'ROOT',
                    }
                },
                mailAlias: {
                    connect: {
                        address: channel.alias ? `${channel.alias}@${process.env.EMAIL_DOMAIN}` : DEFAULT_NOTIFCIATION_ALIAS,
                    }
                }
            }
        }))
    )
})

async function createRootChannel(prisma: PrismaClient, rChan: ChannelInfo, mailAliasAddress: string) {
    // The root is its own parent, so its id has to be known before it is inserted. Taking it from
    // the sequence (rather than guessing max(id) + 1) reserves it, so a later autoincremented
    // insert can never be handed the same id.
    // The table is qualified with the same schema the prisma adapter is given (see client.ts): the
    // adapter qualifies its own queries but leaves search_path alone, so an unqualified name in raw
    // SQL resolves against public - which is not where the tables are in e.g. the test schemas.
    const schema = (process.env.DB_SCHEMA ?? 'public').replace(/"/g, '""')
    const [{ id }] = await prisma.$queryRaw<{ id: bigint }[]>`
        SELECT nextval(pg_get_serial_sequence(${`"${schema}"."NotificationChannel"`}, 'id')) AS id
    `

    // Scalar foreign keys throughout, since parentId cannot be given as a connect - the parent
    // does not exist until this very insert - and prisma will not mix scalar keys with nested writes.
    const [defaultMethods, availableMethods, mailAlias] = await Promise.all([
        prisma.notificationMethod.create({ data: rChan.defaultMethods }),
        prisma.notificationMethod.create({ data: rChan.availableMethods }),
        prisma.mailAlias.findUniqueOrThrow({ where: { address: mailAliasAddress } }),
    ])

    return prisma.notificationChannel.create({
        data: {
            id: Number(id),
            parentId: Number(id),
            name: rChan.name,
            description: rChan.description,
            special: 'ROOT',
            defaultMethodsId: defaultMethods.id,
            availableMethodsId: availableMethods.id,
            mailAliasId: mailAlias.id,
        }
    })
}
