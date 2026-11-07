import { allNotificationMethodsOn } from '@/services/notifications/constants'
import { specialNotificationChannelOperations } from '@/services/notifications/channels/special/operations'
import { defineSeedOperation } from '@/seeder/src/defineSeedOperation'
import { DomainContext } from '@/lib/sites/context'
import { Site } from '@/lib/sites/site'
import type { PrismaClient } from '@/prisma-generated-pn-client'
import type { NotificationMethod } from '@/prisma-generated-pn-types'

type ChannelInfo = {
    name: string
    description: string
    availableMethods: Omit<NotificationMethod, 'id'>
    alias?: string
}

/**
 * The special channels are brought in line with their config, the root first since the others sit
 * under it. The manual channels below are upserted on their unique name, and an existing one is
 * left untouched: its methods, alias and description are edited through the admin pages.
 */
export const seedNotificationChannels = defineSeedOperation(async (prisma: PrismaClient) => {
    const { ROOT, ...otherSpecials } = specialNotificationChannelOperations.channels
    await ROOT.generateChannelFromConfig.internalCall({ prisma })
    await Promise.all(Object.values(otherSpecials).map(channel =>
        channel.generateChannelFromConfig.internalCall({ prisma })
    ))

    const channels: ChannelInfo[] = [
        {
            name: 'Informasjon fra HS',
            description: 'Varsling når Hovedstyret vil gi ut informasjon',
            availableMethods: allNotificationMethodsOn,
            alias: 'hs',
        },
        {
            name: 'Merch',
            description: 'Her kommer det varslinger om Omega Merch fra BlaestCom',
            availableMethods: allNotificationMethodsOn,
            alias: 'bleast',
        },
        {
            name: 'Driftsstatus',
            description: 'Her kommer det varslinger dersom noe på veven ikke fungerer, eller ved planlagt vedlikehold',
            availableMethods: allNotificationMethodsOn,
            alias: 'vevcom',
        },
        {
            name: 'Mat på Gløshaugen',
            description: `Her kommer informasjon om når det er vafler på Lophtet eller 
                          noe annen mat i området rundt El-bygget`,
            availableMethods: {
                email: true,
                emailWeekly: false,
                push: true,
            },
        },
        {
            name: 'Diverse',
            description: 'Her kommer informasjon som ellers ikke passer inn i kategoriene',
            availableMethods: allNotificationMethodsOn,
        },
    ]

    const domain = DomainContext.mailDomainOf(Site.root)

    await Promise.all(channels.map(channel => prisma.notificationChannel.upsert({
        where: { name: channel.name },
        update: {},
        create: {
            purpose: 'MANUAL',
            name: channel.name,
            description: channel.description,
            availableMethods: {
                create: channel.availableMethods,
            },
            parent: {
                connect: {
                    special: 'ROOT',
                }
            },
            mailAlias: {
                connect: {
                    address: `${channel.alias ?? 'noreply'}@${domain}`,
                }
            }
        }
    })))
})
