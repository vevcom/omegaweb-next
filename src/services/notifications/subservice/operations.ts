import '@pn-server-only'
import { notificationSchemas } from './schemas'
import { availableNotificationMethodIncluder } from './constants'
import { methodsAreEqual, validateMethods, validateNewParent } from './helpers'
import { allNotificationMethodsOff, allNotificationMethodsOn } from '@/services/notifications/constants'
import { booleanOperationOnMethods } from '@/services/notifications/methods/helpers'
import { defineSubOperation } from '@/services/serviceOperation'
import { defaultNotificationAlias } from '@/lib/email/constants'
import { ServiceError } from '@/services/error'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { ExpandedNotificationChannel, NotificationResult } from '@/services/notifications/types'

/**
 * The notification channels and the notifications sent in them. A channel is owned by the system
 * that implements these: the special channels by the code, through their config, and the rest by the
 * dynamic system of the admin pages.
 */
export const notificationOperations = {
    createChannel: defineSubOperation({
        dataSchema: () => notificationSchemas.data.createChannel,
        paramsSchema: () => notificationSchemas.params.createChannel,
        opensTransaction: true,
        operation: () => async ({ prisma, data, params }): Promise<ExpandedNotificationChannel> =>
            await prisma.$transaction(async (tx) => {
                const channel = await tx.notificationChannel.create({
                    data: {
                        name: data.name,
                        description: data.description,
                        parent: {
                            connect: {
                                id: data.parentId,
                            }
                        },
                        availableMethods: {
                            create: params.availableMethods,
                        },
                        mailAlias: {
                            connect: {
                                address: defaultNotificationAlias(),
                            }
                        }
                    },
                    include: availableNotificationMethodIncluder,
                })

                // Whoever subscribes to the parent is subscribed to the new channel too, with the
                // methods they have on for the parent, as far as the new channel offers them.
                const parentSubscriptions = await tx.notificationSubscription.findMany({
                    where: {
                        channelId: data.parentId
                    },
                    include: {
                        methods: {
                            select: allNotificationMethodsOn,
                        }
                    }
                })

                await Promise.all(parentSubscriptions
                    .map(subscription => ({
                        ...subscription,
                        subscriptionMethods: booleanOperationOnMethods(
                            subscription.methods,
                            channel.availableMethods,
                            'AND',
                        ),
                    }))
                    .filter(subscription =>
                        !validateMethods(
                            allNotificationMethodsOff,
                            subscription.subscriptionMethods
                        )
                    )
                    .map(subscription => tx.notificationSubscription.create({
                        data: {
                            user: {
                                connect: {
                                    id: subscription.userId,
                                },
                            },
                            channel: {
                                connect: {
                                    id: channel.id,
                                },
                            },
                            methods: {
                                create: subscription.subscriptionMethods
                            }
                        }
                    }))
                )

                return channel
            }),
    }),

    /** The channels the implementing system owns, as its `where` picks them out. */
    readManyChannels: defineSubOperation({
        operation: ({ where }: { where: Prisma.NotificationChannelWhereInput }) =>
            async ({ prisma }): Promise<ExpandedNotificationChannel[]> => await prisma.notificationChannel.findMany({
                where,
                include: availableNotificationMethodIncluder,
            }),
    }),

    updateChannel: defineSubOperation({
        dataSchema: () => notificationSchemas.data.updateChannel,
        paramsSchema: () => notificationSchemas.params.updateChannel,
        opensTransaction: true,
        operation: () => async ({ prisma, data, params }): Promise<ExpandedNotificationChannel> => {
            const channel = await prisma.notificationChannel.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                select: {
                    availableMethods: true,
                }
            })

            const allChannels = await prisma.notificationChannel.findMany({
                include: availableNotificationMethodIncluder,
            })
            if (!validateNewParent(params.id, data.parentId, allChannels)) {
                throw new ServiceError('BAD PARAMETERS', 'Den overordnede kanalen kan ikke gi en løkke.')
            }

            return await prisma.$transaction(async (tx) => {
                if (!methodsAreEqual(params.availableMethods, channel.availableMethods)) {
                    await tx.notificationMethod.update({
                        where: {
                            id: channel.availableMethods.id,
                        },
                        data: params.availableMethods,
                    })
                }

                return tx.notificationChannel.update({
                    where: {
                        id: params.id,
                    },
                    data: {
                        name: data.name,
                        description: data.description,
                        parent: { connect: { id: data.parentId } },
                        mailAlias: {
                            connect: {
                                id: data.mailAliasId,
                            }
                        }
                    },
                    include: availableNotificationMethodIncluder,
                })
            })
        }
    }),

    /**
     * Deletes a channel with its subscriptions and the notifications sent in it. A channel's children
     * must be moved or deleted first.
     */
    destroyChannel: defineSubOperation({
        paramsSchema: () => notificationSchemas.params.destroyChannel,
        opensTransaction: true,
        operation: () => async ({ prisma, params }) => prisma.$transaction(async (tx) => {
            const channel = await tx.notificationChannel.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                select: {
                    availableMethodsId: true,
                    subscriptions: { select: { methodsId: true } },
                    _count: { select: { children: true } },
                },
            })

            if (channel._count.children > 0) {
                throw new ServiceError('BAD PARAMETERS', 'Kanalen har underkanaler. Flytt eller slett dem først.')
            }

            // The subscriptions and notifications cascade with the channel, but the method rows they and
            // the channel point to do not.
            await tx.notificationChannel.delete({
                where: {
                    id: params.id,
                },
            })
            await tx.notificationMethod.deleteMany({
                where: {
                    id: {
                        in: [
                            channel.availableMethodsId,
                            ...channel.subscriptions.map(subscription => subscription.methodsId),
                        ],
                    },
                },
            })
        }),
    }),

    /**
     * Creates a notification in a channel. Nothing is sent here: the notification worker picks it up,
     * resolves who should receive it at that point (channel subscriptions ∩ targeted users ∩
     * visibility ∩ permission ∩ who can register for the event, see methods/recipients.ts) and
     * dispatches it through the channel's available methods.
     *
     * @param data - The notification, optionally restricted to an audience of users, a visibility, a
     * permission and those who can register for an event.
     * @returns The created notification.
     */
    createNotification: defineSubOperation({
        paramsSchema: () => notificationSchemas.params.createNotification,
        dataSchema: () => notificationSchemas.data.createNotification,
        operation: () => async ({ prisma, params, data }): Promise<NotificationResult> => {
            // This prevents notifications from being created - and later dispatched by the
            // notification worker - during seeding.
            if (process.env.IGNORE_SERVER_ONLY) {
                return { notification: null }
            }

            const notification = await prisma.notification.create({
                data: {
                    title: data.title,
                    message: data.message,
                    url: data.url,
                    channel: {
                        connect: {
                            id: params.channelId,
                        },
                    },
                    ...(data.audience?.userIds && data.audience.userIds.length > 0 ? {
                        usersTargeted: {
                            connect: data.audience.userIds.map(userId => ({ id: userId })),
                        },
                    } : {}),
                    ...(data.audience?.visibilityId ? {
                        visibility: {
                            connect: {
                                id: data.audience.visibilityId,
                            },
                        },
                    } : {}),
                    permission: data.audience?.permission,
                    ...(data.audience?.canRegisterForEventId ? {
                        canRegisterForEvent: {
                            connect: {
                                id: data.audience.canRegisterForEventId,
                            },
                        },
                    } : {}),
                }
            })

            return { notification }
        }
    }),
} as const
