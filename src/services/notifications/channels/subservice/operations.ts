import '@pn-server-only'
import { notificationChannelSchemas } from './schemas'
import { availableNotificationMethodIncluder } from './constants'
import { methodsAreEqual, validateNewParent } from './helpers'
import { defineSubOperation } from '@/services/serviceOperation'
import { visibilityOperations } from '@/services/visibility/operations'
import { defaultNotificationAlias } from '@/services/mail/send/constants'
import { ServiceError } from '@/services/error'
import type { NotificationChannelPurpose, Prisma } from '@/prisma-generated-pn-types'
import type { ExpandedNotificationChannel, NotificationResult } from '@/services/notifications/types'

/**
 * The notification channels and the notifications sent in them. A channel is owned by the system
 * that implements these, which its purpose names: the special channels by the code, through their
 * config, the manual ones by the admin pages, and an event's by that event.
 */
export const notificationChannelOperations = {
    /**
     * Creates a channel under its parent. Those subscribed to the parent reach it through that
     * subscription, which resolves through the channels above, see subscription/resolve.ts, so
     * nothing is copied and a channel costs the same however many subscribers the parent has.
     */
    create: defineSubOperation({
        dataSchema: () => notificationChannelSchemas.data.create,
        paramsSchema: () => notificationChannelSchemas.params.create,
        operation: ({ purpose }: { purpose: NotificationChannelPurpose }) =>
            async ({ prisma, data, params }): Promise<ExpandedNotificationChannel> => prisma.notificationChannel.create({
                data: {
                    purpose,
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
                    },
                },
                include: availableNotificationMethodIncluder,
            }),
    }),

    /** The channels the implementing system owns, as its `where` picks them out. */
    readMany: defineSubOperation({
        operation: ({ where }: { where: Prisma.NotificationChannelWhereInput }) =>
            async ({ prisma }): Promise<ExpandedNotificationChannel[]> => await prisma.notificationChannel.findMany({
                where,
                include: availableNotificationMethodIncluder,
            }),
    }),

    update: defineSubOperation({
        dataSchema: () => notificationChannelSchemas.data.update,
        paramsSchema: () => notificationChannelSchemas.params.update,
        transaction: 'RUNS_IN',
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

            if (!methodsAreEqual(params.availableMethods, channel.availableMethods)) {
                await prisma.notificationMethod.update({
                    where: {
                        id: channel.availableMethods.id,
                    },
                    data: params.availableMethods,
                })
            }

            return prisma.notificationChannel.update({
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
        }
    }),

    /**
     * Deletes a channel with its subscriptions and the notifications sent in it. A channel's children
     * must be moved or deleted first. The method rows the channel and its subscriptions point to do
     * not cascade, so they go after it: run it in a transaction where that must hold.
     */
    destroy: defineSubOperation({
        paramsSchema: () => notificationChannelSchemas.params.destroy,
        operation: () => async ({ prisma, params }) => {
            const channel = await prisma.notificationChannel.findUniqueOrThrow({
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

            await prisma.notificationChannel.delete({
                where: {
                    id: params.id,
                },
            })
            await prisma.notificationMethod.deleteMany({
                where: {
                    id: {
                        in: [
                            channel.availableMethodsId,
                            ...channel.subscriptions.map(subscription => subscription.methodsId),
                        ],
                    },
                },
            })
        },
    }),

    /**
     * Creates a notification in a channel. Nothing is sent here: the notification worker picks it up,
     * resolves who should receive it at that point (channel subscriptions ∩ targeted users ∩
     * visibility ∩ permission ∩ who can register for, or is registered for, the event, see
     * methods/recipients.ts) and
     * dispatches it through the channel's available methods.
     *
     * @param data - The notification, optionally restricted to an audience of users, a visibility, a
     * permission, those who can register for an event and those registered for one. The visibility
     * is one that exists or, given requirements, one made for the notification alone.
     * @returns The created notification.
     */
    createNotification: defineSubOperation({
        paramsSchema: () => notificationChannelSchemas.params.createNotification,
        dataSchema: () => notificationChannelSchemas.data.createNotification,
        transaction: 'RUNS_IN',
        operation: () => async ({ prisma, params, data }): Promise<NotificationResult> => {
            // This prevents notifications from being created - and later dispatched by the
            // notification worker - during seeding.
            if (process.env.IGNORE_SERVER_ONLY) {
                return { notification: null }
            }

            const ownVisibility = data.audience?.requirements?.length
                ? await visibilityOperations.createWithRequirements.internalCall({
                    prisma,
                    data: { requirements: data.audience.requirements },
                })
                : null
            const visibilityId = ownVisibility?.id ?? data.audience?.visibilityId

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
                    ...(visibilityId ? {
                        visibility: {
                            connect: {
                                id: visibilityId,
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
                    ...(data.audience?.registeredForEventId ? {
                        registeredForEvent: {
                            connect: {
                                id: data.audience.registeredForEventId,
                            },
                        },
                    } : {}),
                }
            })

            return { notification }
        }
    }),
} as const
