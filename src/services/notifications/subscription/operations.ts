import '@pn-server-only'
import { notificationMethodIncluder } from './constants'
import { notificationSubscriptionAuth } from './auth'
import { subscriptionSchemas } from './schemas'
import { validateMethods } from '@/services/notifications/channel/schemas'
import { allNotificationMethodsOff, allNotificationMethodsOn } from '@/services/notifications/constants'
import { availableNotificationMethodIncluder } from '@/services/notifications/channel/constants'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { z } from 'zod'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { Subscription } from './types'
import type { NotificationMethodGeneral } from '@/services/notifications/types'


async function createTransactionPart(
    prisma: Prisma.TransactionClient,
    userId: number,
    channelId: number,
    methods: NotificationMethodGeneral
): Promise<(() => Promise<Subscription>) | null> {
    const whereFilter = {
        userId_channelId: {
            userId,
            channelId,
        }
    }

    const subscription = await prisma.notificationSubscription.findUnique({
        where: whereFilter
    })

    const subscriptionExists = subscription !== null

    // If all methods are off, we delete the relation
    if (validateMethods(allNotificationMethodsOff, methods)) {
        // No change, do nothing
        if (!subscriptionExists) {
            return null
        }

        // Delete the realtion
        return async () => {
            const sub = await prisma.notificationSubscription.delete({
                where: whereFilter,
                include: notificationMethodIncluder,
            })

            await prisma.notificationMethod.delete({
                where: {
                    id: sub.methodsId
                }
            })

            return sub
        }
    }

    // Verify that the new methods are a subset of the available methods
    const notificationChannel = await prisma.notificationChannel.findUniqueOrThrow({
        where: {
            id: channelId,
        },
        include: availableNotificationMethodIncluder,
    })

    if (!validateMethods(notificationChannel.availableMethods, methods)) {
        throw new ServiceError('BAD PARAMETERS', 'The methods must a subset of the available methods')
    }

    // Update the relation
    if (subscriptionExists) {
        return async () => {
            const results = await prisma.notificationMethod.update({
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
    }

    // Create the relation
    return () => prisma.notificationSubscription.create({
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

export const notificationSubscriptionOperations = {
    read: defineOperation({
        paramsSchema: z.object({
            userId: z.number(),
        }),
        authorizer: ({ params }) => notificationSubscriptionAuth.read.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => await prisma.notificationSubscription.findMany({
            where: {
                userId: params.userId,
            },
            include: notificationMethodIncluder,
        }),
    }),

    createDefault: defineSubOperation({
        paramsSchema: () => z.object({
            userId: z.number(),
        }),
        opensTransaction: true,
        operation: () => async ({ prisma, params, session }) => {
            const channels = await notificationChannelOperations.readDefault({
                session,
                bypassAuth: true,
            })

            await prisma.$transaction(channels.map(channel =>
                prisma.notificationSubscription.create({
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
            ))
        }
    }),


    update: defineOperation({
        authorizer: ({ params }) => notificationSubscriptionAuth.update.data({ userId: params.userId }),
        paramsSchema: z.object({
            userId: z.number(),
        }),
        dataSchema: subscriptionSchemas.update,
        operation: async ({ prisma, params, data }): Promise<Subscription[]> => {
            // Prepare updates and validate the data with the data in the database
            const transactionParts = (await Promise.all(
                data.subscriptions.map(subscription =>
                    createTransactionPart(prisma, params.userId, subscription.channelId, subscription.methods)
                )
            )).filter(i => i !== null)

            // Update the subscriptions
            return await Promise.all(
                transactionParts.map(part => part())
            )
        }
    }),
} as const
