import '@pn-server-only'
import { dynamicNotificationChannelAuth } from './auth'
import { notificationChannelOperations } from '@/services/notifications/channels/subservice/operations'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * The channels made on the admin pages. Those are the channels that are not special: the special
 * ones belong to the code and are neither changed nor sent in from here, though a dynamic channel
 * may be put under one.
 */
export const dynamicNotificationChannelOperations = {
    create: notificationChannelOperations.create.implement({
        authorizer: () => dynamicNotificationChannelAuth.create,
        // A new channel is dynamic by construction, whatever its parent is.
        ownershipCheck: () => true,
    }),

    readMany: notificationChannelOperations.readMany.implement({
        authorizer: () => dynamicNotificationChannelAuth.readMany,
        ownershipCheck: () => true,
        operationImplementationFields: { where: ownershipCheckWhereCondition() },
    }),

    update: notificationChannelOperations.update.implement({
        authorizer: () => dynamicNotificationChannelAuth.update,
        ownershipCheck: ({ params, prisma }) => ownershipCheck(prisma, params.id),
    }),

    destroy: notificationChannelOperations.destroy.implement({
        authorizer: () => dynamicNotificationChannelAuth.destroy,
        ownershipCheck: ({ params, prisma }) => ownershipCheck(prisma, params.id),
    }),

    createNotification: notificationChannelOperations.createNotification.implement({
        authorizer: () => dynamicNotificationChannelAuth.createNotification,
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
