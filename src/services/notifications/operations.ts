import '@pn-server-only'
import { notificationAuth } from './auth'
import { notificationSchemas } from './schemas'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { SpecialNotificationChannel } from '@/prisma-generated-pn-types'
import { z } from 'zod'
import type { NotificationResult } from './types'

export const notificationOperations = {
    /**
     * Creates a notification. Nothing is sent here: the notification worker picks it up, resolves
     * who should receive it at that point (channel subscriptions ∩ targeted users ∩ visibility ∩
     * permission, see methods/recipients.ts) and dispatches it through the channel's available methods.
     *
     * @param data - The notification, optionally restricted to an audience of users, a visibility and a permission.
     * @returns The created notification.
     */
    create: defineOperation({
        authorizer: () => notificationAuth.create,
        dataSchema: notificationSchemas.create,
        operation: async ({ prisma, data }): Promise<NotificationResult> => {
            // This prevents notifications from being created - and later dispatched by the
            // notification worker - during seeding.
            if (process.env.IGNORE_SERVER_ONLY) {
                return { notification: null }
            }

            const notification = await prisma.notification.create({
                data: {
                    title: data.title,
                    message: data.message,
                    channel: {
                        connect: {
                            id: data.channelId,
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
                }
            })

            return { notification }
        }
    }),

    /**
     * Createses a notification to a special notification channel.
     *
     * @param special - The special notification channel to dispatch the notification to.
     * @param title - The title of the notification.
     * @param message - The message content of the notification.
     * @returns A promise that resolves with an object containing the dispatched notification and the number of recipients.
     */
    createSpecial: defineSubOperation({
        paramsSchema: () => z.object({
            special: z.nativeEnum(SpecialNotificationChannel),
        }),
        dataSchema: () => notificationSchemas.createSpecial,
        operation: () => async ({ prisma, params, data, session }): Promise<NotificationResult> => {
            const channel = await prisma.notificationChannel.findUniqueOrThrow({
                where: {
                    special: params.special,
                }
            })

            return await notificationOperations.create({
                session,
                bypassAuth: true,
                data: {
                    channelId: channel.id,
                    title: data.title,
                    message: data.message,
                    audience: data.audience,
                }
            })
        }
    }),
} as const
