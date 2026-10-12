import '@pn-server-only'
import { notificationChannelAuth } from './auth'
import { notificationChannelSchemas, validateMethods, validateNewParent } from './schemas'
import { availableNotificationMethodIncluder } from './constants'
import {
    allNotificationMethodsOff,
    allNotificationMethodsOn,
    notificationMethodsArray,
} from '@/services/notifications/constants'
import { notificationMethodSchema } from '@/services/notifications/schemas'
import { booleanOperationOnMethods } from '@/services/notifications/methods/helpers'
import { defineOperation } from '@/services/serviceOperation'
import { DEFAULT_NOTIFICATION_ALIAS } from '@/lib/email/constants'
import { ServiceError } from '@/services/error'
import { z } from 'zod'
import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'

export const notificationChannelOperations = {
    create: defineOperation({
        authorizer: () => notificationChannelAuth.create,
        dataSchema: notificationChannelSchemas.create,
        opensTransaction: true,
        paramsSchema: z.object({
            availableMethods: notificationMethodSchema,
            defaultMethods: notificationMethodSchema,
        }),
        operation: async ({ prisma, data, params }): Promise<ExpandedNotificationChannel> => {
            if (!validateMethods(params.availableMethods, params.defaultMethods)) {
                throw new ServiceError('BAD PARAMETERS', 'Default methods cannot exceed available methods.')
            }

            const channel = await prisma.notificationChannel.create({
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

            await prisma.$transaction(async (tx) => {
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
                    .filter(sub =>
                        !validateMethods(
                            allNotificationMethodsOff,
                            sub.subscriptionMethods
                        )
                    )
                    .map(sub => tx.notificationSubscription.create({
                        data: {
                            user: {
                                connect: {
                                    id: sub.userId,
                                },
                            },
                            channel: {
                                connect: {
                                    id: channel.id,
                                },
                            },
                            methods: {
                                create: sub.subscriptionMethods
                            }
                        }
                    }))
                )
            })

            return channel
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
        dataSchema: notificationChannelSchemas.update,
        paramsSchema: z.object({
            id: z.number(),
            availableMethods: notificationMethodSchema,
            defaultMethods: notificationMethodSchema,
        }),
        opensTransaction: true,
        operation: async ({ prisma, data, params }) => {
            if (!validateMethods(params.availableMethods, params.defaultMethods)) {
                throw new ServiceError('BAD PARAMETERS', 'Default methods cannot exceed available methods.')
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
                    throw new ServiceError('BAD PARAMETERS', 'Cannot set parentId in a loop')
                }

                updateParentId = true
            }

            function methodsAreEqual(lhs: NotificationMethodGeneral, rhs: NotificationMethodGeneral) {
                for (let i = 0; i < notificationMethodsArray.length; i++) {
                    if (lhs[notificationMethodsArray[i]] !== rhs[notificationMethodsArray[i]]) {
                        return false
                    }
                }
                return true
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

    // TODO: It should probably be possible to delete a channel from the frontend (if not default) - Johan
    // It doesn't seem that this function is used yet. -Theodor
    destroy: defineOperation({
        authorizer: () => notificationChannelAuth.destroy,
        paramsSchema: z.object({
            id: z.number(),
        }),
        opensTransaction: true,
        operation: async ({ prisma, params }) => prisma.$transaction(async (tx) => {
            // NOTE: this should maybe be just a archive not a delete

            const results = await tx.notificationChannel.delete({
                where: {
                    id: params.id,
                },
                include: availableNotificationMethodIncluder,
            })

            await tx.notificationMethod.deleteMany({
                where: {
                    OR: [
                        { id: results.availableMethodsId },
                        { id: results.defaultMethodsId },
                    ]
                }
            })

            return results
        })
    }),
} as const
