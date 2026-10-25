import '@pn-server-only'
import { notificationChannelAuth } from './auth'
import { notificationChannelSchemas } from './schemas'
import { availableNotificationMethodIncluder } from './constants'
import { methodsAreEqual, validateMethods, validateNewParent } from './helpers'
import {
    allNotificationMethodsOff,
    allNotificationMethodsOn,
    notificationMethodsArray,
} from '@/services/notifications/constants'
import { booleanOperationOnMethods } from '@/services/notifications/methods/helpers'
import { defineOperation } from '@/services/serviceOperation'
import { DEFAULT_NOTIFICATION_ALIAS } from '@/lib/email/constants'
import { ServiceError } from '@/services/error'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'

export const notificationChannelOperations = {
    create: defineOperation({
        authorizer: () => notificationChannelAuth.create,
        dataSchema: notificationChannelSchemas.data.create,
        opensTransaction: true,
        paramsSchema: notificationChannelSchemas.params.create,
        operation: async ({ prisma, data, params }): Promise<ExpandedNotificationChannel> => {
            if (!validateMethods(params.availableMethods, params.defaultMethods)) {
                throw new ServiceError('BAD PARAMETERS', 'Standardmetodene må være blant de tilgjengelige metodene.')
            }

            return await prisma.$transaction(async (tx) => {
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
                        defaultMethods: {
                            create: params.defaultMethods,
                        },
                        mailAlias: {
                            connect: {
                                address: DEFAULT_NOTIFICATION_ALIAS,
                            }
                        }
                    },
                    include: availableNotificationMethodIncluder,
                })

                if (validateMethods(allNotificationMethodsOff, params.defaultMethods)) {
                    return channel
                }

                // Whoever subscribes to the parent is subscribed to the new channel too, with the
                // default methods they already have on for the parent.
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
                        subscriptionMethods: booleanOperationOnMethods(subscription.methods, channel.defaultMethods, 'AND')
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
            })
        }
    }),

    readMany: defineOperation({
        authorizer: () => notificationChannelAuth.readMany,
        operation: async ({ prisma }) => await prisma.notificationChannel.findMany({
            include: availableNotificationMethodIncluder,
        })
    }),

    readDefault: defineOperation({
        authorizer: () => notificationChannelAuth.readDefault,
        operation: async ({ prisma }) => await prisma.notificationChannel.findMany({
            where: {
                defaultMethods: {
                    OR: notificationMethodsArray.map(method => ({
                        [method]: true
                    }))
                }
            },
            include: availableNotificationMethodIncluder,
        })
    }),

    update: defineOperation({
        authorizer: () => notificationChannelAuth.update,
        dataSchema: notificationChannelSchemas.data.update,
        paramsSchema: notificationChannelSchemas.params.update,
        opensTransaction: true,
        operation: async ({ prisma, data, params }) => {
            if (!validateMethods(params.availableMethods, params.defaultMethods)) {
                throw new ServiceError('BAD PARAMETERS', 'Standardmetodene må være blant de tilgjengelige metodene.')
            }

            // Check if the channel is special
            const channel = await prisma.notificationChannel.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                select: {
                    special: true,
                    availableMethods: true,
                    defaultMethods: true,
                }
            })

            let updateParentId = false

            // Not allowed to change the parent of ROOT
            if (channel.special !== 'ROOT') {
                const allChannels = await notificationChannelOperations.readMany({
                    bypassAuth: true,
                })

                if (!validateNewParent(params.id, data.parentId, allChannels)) {
                    throw new ServiceError('BAD PARAMETERS', 'Den overordnede kanalen kan ikke gi en løkke.')
                }

                updateParentId = true
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

                if (!methodsAreEqual(params.defaultMethods, channel.defaultMethods)) {
                    await tx.notificationMethod.update({
                        where: {
                            id: channel.defaultMethods.id,
                        },
                        data: params.defaultMethods,
                    })
                }

                return tx.notificationChannel.update({
                    where: {
                        id: params.id,
                    },
                    data: {
                        name: data.name,
                        description: data.description,
                        ...(updateParentId ? { parent: { connect: { id: data.parentId } } } : {}),
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
     * Deletes a channel with its subscriptions and the notifications sent in it. Special channels are
     * used by the code and cannot be deleted, and a channel's children must be moved or deleted first.
     */
    destroy: defineOperation({
        authorizer: () => notificationChannelAuth.destroy,
        paramsSchema: notificationChannelSchemas.params.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params }) => prisma.$transaction(async (tx) => {
            const channel = await tx.notificationChannel.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                select: {
                    special: true,
                    availableMethodsId: true,
                    defaultMethodsId: true,
                    subscriptions: { select: { methodsId: true } },
                    _count: { select: { children: true } },
                },
            })

            if (channel.special) {
                throw new ServiceError('BAD PARAMETERS', 'Spesielle kanaler kan ikke slettes.')
            }
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
                            channel.defaultMethodsId,
                            ...channel.subscriptions.map(subscription => subscription.methodsId),
                        ],
                    },
                },
            })
        }),
    }),
} as const
