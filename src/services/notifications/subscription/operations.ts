import '@pn-server-only'
import { notificationMethodIncluder } from './constants'
import { notificationSubscriptionAuth } from './auth'
import { notificationSubscriptionSchemas } from './schemas'
import { validateMethods } from '@/services/notifications/channel/helpers'
import { allNotificationMethodsOff, allNotificationMethodsOn } from '@/services/notifications/constants'
import { availableNotificationMethodIncluder } from '@/services/notifications/channel/constants'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
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
     * Subscribes the user to every default channel they are not already subscribed to. Opens no
     * transaction of its own, so that registration can run it on its own transaction, and skips the
     * channels the user already has, so running it again is harmless.
     */
    createDefault: defineSubOperation({
        paramsSchema: () => notificationSubscriptionSchemas.params.createDefault,
        operation: () => async ({ prisma, params, session }) => {
            const channels = await notificationChannelOperations.readDefault({
                session,
                prisma,
                bypassAuth: true,
            })
            const subscribed = new Set((await prisma.notificationSubscription.findMany({
                where: { userId: params.userId },
                select: { channelId: true },
            })).map(subscription => subscription.channelId))

            for (const channel of channels.filter(defaultChannel => !subscribed.has(defaultChannel.id))) {
                await prisma.notificationSubscription.create({
                    data: {
                        user: {
                            connect: {
                                id: params.userId,
                            }
                        },
                        channel: {
                            connect: {
                                id: channel.id,
                            }
                        },
                        methods: {
                            create: channel.defaultMethods,
                        }
                    }
                })
            }
        }
    }),

    update: defineOperation({
        authorizer: ({ params }) => notificationSubscriptionAuth.update.data({ userId: params.userId }),
        paramsSchema: notificationSubscriptionSchemas.params.update,
        dataSchema: notificationSubscriptionSchemas.data.update,
        opensTransaction: true,
        operation: async ({ prisma, params, data }): Promise<Subscription[]> => await prisma.$transaction(
            async (tx) => {
                // One bad subscription rolls back the whole batch, so the user never ends up with half of it.
                const subscriptions = await Promise.all(
                    data.subscriptions.map(subscription =>
                        applySubscription(tx, params.userId, subscription.channelId, subscription.methods)
                    )
                )
                return subscriptions.filter(subscription => subscription !== null)
            }
        ),
    }),
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
