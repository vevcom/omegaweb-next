import '@pn-server-only'
import { dynamicNotificationAuth } from './auth'
import { notificationOperations } from '@/services/notifications/subservice/operations'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * The channels made on the admin pages. Those are the channels that are not special: the special
 * ones belong to the code and are neither changed nor sent in from here, though a dynamic channel
 * may be put under one.
 */
export const dynamicNotificationOperations = {
    createChannel: notificationOperations.createChannel.implement({
        authorizer: () => dynamicNotificationAuth.createChannel,
        // A new channel is dynamic by construction, whatever its parent is.
        ownershipCheck: () => true,
    }),

    readManyChannels: notificationOperations.readManyChannels.implement({
        authorizer: () => dynamicNotificationAuth.readManyChannels,
        ownershipCheck: () => true,
        operationImplementationFields: { where: ownershipCheckWhereCondition() },
    }),

    updateChannel: notificationOperations.updateChannel.implement({
        authorizer: () => dynamicNotificationAuth.updateChannel,
        ownershipCheck: ({ params, prisma }) => ownershipCheck(prisma, params.id),
    }),

    destroyChannel: notificationOperations.destroyChannel.implement({
        authorizer: () => dynamicNotificationAuth.destroyChannel,
        ownershipCheck: ({ params, prisma }) => ownershipCheck(prisma, params.id),
    }),

    createNotification: notificationOperations.createNotification.implement({
        authorizer: () => dynamicNotificationAuth.createNotification,
        ownershipCheck: ({ params, prisma }) => ownershipCheck(prisma, params.channelId),
    }),
} as const

function ownershipCheckWhereCondition() {
    return {
        special: null,
    } satisfies Prisma.NotificationChannelWhereInput
}

/** Whether the channel is one of the dynamic system's, which is to say not special. */
async function ownershipCheck(prisma: PrismaPossibleTransaction<false>, channelId: number): Promise<boolean> {
    const channel = await prisma.notificationChannel.findUnique({
        where: { id: channelId },
        select: { special: true },
    })
    return channel !== null && channel.special === null
}
