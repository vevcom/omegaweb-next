import '@pn-server-only'
import { notificationMethodIncluder } from './constants'
import { notificationSubscriptionAuth } from './auth'
import { notificationSubscriptionSchemas } from './schemas'
import { findDescendantIds, validateMethods } from '@/services/notifications/channels/subservice/helpers'
import { allNotificationMethodsOff, allNotificationMethodsOn } from '@/services/notifications/constants'
import { booleanOperationOnMethods } from '@/services/notifications/methods/helpers'
import { availableNotificationMethodIncluder } from '@/services/notifications/channels/subservice/constants'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { Subscription } from './types'
import type { NotificationMethodGeneral } from '@/services/notifications/types'

export const notificationSubscriptionOperations = {
    read: defineOperation({
        paramsSchema: notificationSubscriptionSchemas.params.read,
        authorizer: ({ params }) => notificationSubscriptionAuth.read.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => await prisma.notificationSubscription.findMany({
            where: {
                userId: params.userId,
            },
            include: notificationMethodIncluder,
        }),
    }),

    /**
     * Sets the user's methods for a channel, and when asked for the channels under it too, each as
     * far as it offers them. Every method off means no subscription.
     * @returns The subscriptions as they are afterwards, without the ones that ended up off.
     */
    update: defineOperation({
        authorizer: ({ params }) => notificationSubscriptionAuth.update.data({ userId: params.userId }),
        paramsSchema: notificationSubscriptionSchemas.params.update,
        dataSchema: notificationSubscriptionSchemas.data.update,
        opensTransaction: true,
        operation: async ({ prisma, params, data: { includeChildren, ...methods } }): Promise<Subscription[]> => {
            const changes = [{ channelId: params.channelId, methods }]
            if (includeChildren) {
                const channels = await prisma.notificationChannel.findMany({ include: availableNotificationMethodIncluder })
                const descendantIds = findDescendantIds(params.channelId, channels)
                changes.push(...channels
                    .filter(channel => descendantIds.includes(channel.id))
                    .map(channel => ({
                        channelId: channel.id,
                        methods: booleanOperationOnMethods(methods, channel.availableMethods, 'AND'),
                    })))
            }

            // One bad subscription rolls back the whole batch, so the user never ends up with half of it.
            return await prisma.$transaction(async (tx) => {
                const subscriptions = await Promise.all(changes.map(change =>
                    applySubscription(tx, params.userId, change.channelId, change.methods)
                ))
                return subscriptions.filter(subscription => subscription !== null)
            })
        },
    }),

    internal: {
        /**
         * Subscribes a user to a channel with every method it offers, for a system that signs its
         * users up as a default, such as an event its registrants. A subscription they have already
         * is left as it is.
         */
        subscribeByDefault: defineSubOperation({
            paramsSchema: () => notificationSubscriptionSchemas.params.subscribeByDefault,
            operation: () => async ({ prisma, params }): Promise<void> => {
                const existing = await prisma.notificationSubscription.findUnique({
                    where: { userId_channelId: params },
                    select: { id: true },
                })
                if (existing) return

                const channel = await prisma.notificationChannel.findUniqueOrThrow({
                    where: { id: params.channelId },
                    include: availableNotificationMethodIncluder,
                })
                await prisma.notificationSubscription.create({
                    data: {
                        user: { connect: { id: params.userId } },
                        channel: { connect: { id: params.channelId } },
                        methods: { create: channel.availableMethods },
                    },
                })
            },
        }),
    },
} as const

/**
 * Brings one subscription in line with the given methods: created when it does not exist, updated
 * when it does, and deleted when every method is off.
 * @returns The subscription as it is afterwards, or null when there was nothing to change.
 */
async function applySubscription(
    tx: Prisma.TransactionClient,
    userId: number,
    channelId: number,
    methods: NotificationMethodGeneral
): Promise<Subscription | null> {
    const whereFilter = {
        userId_channelId: {
            userId,
            channelId,
        }
    }

    const subscription = await tx.notificationSubscription.findUnique({
        where: whereFilter
    })

    // If all methods are off, we delete the relation
    if (validateMethods(allNotificationMethodsOff, methods)) {
        // No change, do nothing
        if (subscription === null) {
            return null
        }

        const deleted = await tx.notificationSubscription.delete({
            where: whereFilter,
            include: notificationMethodIncluder,
        })

        await tx.notificationMethod.delete({
            where: {
                id: deleted.methodsId
            }
        })

        return deleted
    }

    // Verify that the new methods are a subset of the available methods
    const notificationChannel = await tx.notificationChannel.findUniqueOrThrow({
        where: {
            id: channelId,
        },
        include: availableNotificationMethodIncluder,
    })

    if (!validateMethods(notificationChannel.availableMethods, methods)) {
        throw new ServiceError('BAD PARAMETERS', 'Metodene må være blant de tilgjengelige metodene.')
    }

    // Update the relation
    if (subscription !== null) {
        const results = await tx.notificationMethod.update({
            where: {
                id: subscription.methodsId,
            },
            data: methods,
            select: allNotificationMethodsOn,
        })

        return {
            ...subscription,
            methods: results,
        }
    }

    // Create the relation
    return await tx.notificationSubscription.create({
        data: {
            channel: {
                connect: {
                    id: channelId,
                },
            },
            user: {
                connect: {
                    id: userId,
                },
            },
            methods: {
                create: methods,
            },
        },
        include: notificationMethodIncluder,
    })
}
