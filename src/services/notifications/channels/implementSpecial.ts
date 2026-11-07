import '@pn-server-only'
import { notificationChannelOperations } from './subservice/operations'
import { notificationChannelSchemas } from './subservice/schemas'
import { availableNotificationMethodIncluder } from './subservice/constants'
import { specialNotificationChannelAuth } from './special/auth'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { DomainContext } from '@/lib/sites/context'
import { reserveId } from '@/lib/reserveId'
import { Site } from '@/lib/sites/site'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { SpecialNotificationChannel } from '@/prisma-generated-pn-types'
import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'

export type SpecialNotificationChannelConfig = {
    name: string,
    description: string,
    availableMethods: NotificationMethodGeneral,
    /** The local part of the channel's mail alias on the root site's mail domain. The noreply alias when left out. */
    alias?: string,
}

/** What a special channel needs of its parent: to read it, creating it when it is missing. */
type ParentChannel = {
    readChannelInternal: (args: { prisma: PrismaPossibleTransaction<false> }) => Promise<ExpandedNotificationChannel>,
}

/**
 * A notification channel the code sends in, owned by the service that implements it. It is what its
 * config says and nothing on the site changes it: it is created from the config when first read and
 * brought in line with it by the seeder. Notifications are only created in it from server code.
 * Users subscribe to it like any other channel, and the channels of other purposes may be put under it.
 *
 * The root is the one channel without a parent: it is its own.
 */
export function implementSpecialNotificationChannel({
    special,
    parent,
    config,
}: {
    config: SpecialNotificationChannelConfig,
} & ({
    special: 'ROOT',
    parent?: undefined,
} | {
    special: Exclude<SpecialNotificationChannel, 'ROOT'>,
    parent: ParentChannel,
})) {
    const readParentId = async (prisma: PrismaPossibleTransaction<false>): Promise<number> =>
        (await parent!.readChannelInternal({ prisma })).id

    const generateChannelFromConfig = defineSubOperation({
        operation: () => async ({ prisma }): Promise<ExpandedNotificationChannel> => {
            const mailAlias = { connect: { address: aliasAddress(config.alias) } }
            const existing = await prisma.notificationChannel.findUnique({
                where: { special },
                select: { availableMethodsId: true },
            })
            if (existing) {
                await prisma.notificationMethod.update({
                    where: { id: existing.availableMethodsId },
                    data: config.availableMethods,
                })
                return prisma.notificationChannel.update({
                    where: { special },
                    data: {
                        name: config.name,
                        description: config.description,
                        mailAlias,
                        ...(parent ? { parent: { connect: { id: await readParentId(prisma) } } } : {}),
                    },
                    include: availableNotificationMethodIncluder,
                })
            }

            if (!parent) return createRootChannel(prisma, config)

            return prisma.notificationChannel.create({
                data: {
                    purpose: 'SPECIAL',
                    special,
                    name: config.name,
                    description: config.description,
                    availableMethods: { create: config.availableMethods },
                    parent: { connect: { id: await readParentId(prisma) } },
                    mailAlias,
                },
                include: availableNotificationMethodIncluder,
            })
        }
    })

    /** The channel, created from the config when it does not exist yet. */
    const readChannelInternal = async (
        { prisma }: { prisma: PrismaPossibleTransaction<false> }
    ): Promise<ExpandedNotificationChannel> => {
        const channel = await prisma.notificationChannel.findUnique({
            where: { special },
            include: availableNotificationMethodIncluder,
        })
        return channel ?? await generateChannelFromConfig.internalCall({ prisma })
    }

    const readChannel = defineOperation({
        authorizer: () => specialNotificationChannelAuth.readChannel,
        operation: async ({ prisma }) => readChannelInternal({ prisma }),
    })

    const createNotification = defineSubOperation({
        dataSchema: () => notificationChannelSchemas.data.createNotification,
        operation: () => async ({ prisma, data }) => notificationChannelOperations.createNotification.internalCall({
            params: {
                channelId: (await readChannelInternal({ prisma })).id,
            },
            data,
        })
    })

    return {
        special,
        internalOperations: {
            createNotification,
        },
        readChannel,
        readChannelInternal,
        generateChannelFromConfig,
    } as const
}

export type SpecialNotificationChannelImplementation = ReturnType<typeof implementSpecialNotificationChannel>

function aliasAddress(alias: string | undefined): string {
    return `${alias ?? 'noreply'}@${DomainContext.mailDomainOf(Site.root)}`
}

async function createRootChannel(
    prisma: PrismaPossibleTransaction<false>,
    config: SpecialNotificationChannelConfig,
): Promise<ExpandedNotificationChannel> {
    // The root is its own parent, so its id has to be known before it is inserted.
    const id = await reserveId(prisma, 'NotificationChannel')

    // Scalar foreign keys throughout, since parentId cannot be given as a connect - the parent
    // does not exist until this very insert - and prisma will not mix scalar keys with nested writes.
    const [availableMethods, mailAlias] = await Promise.all([
        prisma.notificationMethod.create({ data: config.availableMethods }),
        prisma.mailAlias.findUniqueOrThrow({ where: { address: aliasAddress(config.alias) } }),
    ])

    return prisma.notificationChannel.create({
        data: {
            id,
            parentId: id,
            name: config.name,
            description: config.description,
            purpose: 'SPECIAL',
            special: 'ROOT',
            availableMethodsId: availableMethods.id,
            mailAliasId: mailAlias.id,
        },
        include: availableNotificationMethodIncluder,
    })
}
