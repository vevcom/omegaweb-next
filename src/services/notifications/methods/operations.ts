import '@pn-server-only'
import { sendNotificationEmails } from './dispatch'
import { sendWeeklyEmailDigest } from './dispatchWeekly'
import { notificationDispatchIncluder, recipientsWhere } from './recipients'
import logger from '@/lib/logger'
import { userBasicSelection } from '@/services/users/constants'
import { permissionOperations } from '@/services/permissions/operations'
import { defineSubOperation } from '@/services/serviceOperation'
import { z } from 'zod'

export const notificationMethodOperations = {
    /**
     * Dispatches one notification through the immediate email method: resolves who should receive
     * it right now (see recipientsWhere), sends them the mail, and marks the notification email-
     * dispatched. The caller (the notification worker) is responsible for claiming the
     * notification first, so two workers never dispatch the same one.
     */
    dispatchEmail: defineSubOperation({
        paramsSchema: () => z.object({
            notificationId: z.number(),
        }),
        operation: () => async ({ prisma, params }) => {
            const notification = await prisma.notification.findUniqueOrThrow({
                where: { id: params.notificationId },
                include: notificationDispatchIncluder,
            })

            const defaultPermissions = await permissionOperations.readDefaultPermissions({ bypassAuth: true })
            const recipients = await prisma.user.findMany({
                where: recipientsWhere(notification, 'email', defaultPermissions),
                select: { ...userBasicSelection, email: true },
            })

            const sent = await sendNotificationEmails(notification.channel.mailAlias.address, notification, recipients)

            await prisma.notification.update({
                where: { id: notification.id },
                data: { emailDispatchedAt: new Date() },
            })

            return { recipients: sent }
        },
    }),

    /**
     * Materializes the weekly digest outbox: for every weekly-undispatched notification created
     * before `params.before`, resolves who should receive it right now (so subscription,
     * membership and visibility changes since creation count) and writes one outbox row per
     * recipient - marking the notifications weekly-dispatched in the same transaction, which is
     * what makes repeated calls on the digest day harmless. The rows are sent and deleted by
     * sendWeeklyMail.
     */
    materializeWeeklyOutbox: defineSubOperation({
        paramsSchema: () => z.object({
            before: z.date(),
        }),
        opensTransaction: true,
        operation: () => async ({ prisma, params }) => {
            const notifications = await prisma.notification.findMany({
                where: {
                    emailWeeklyDispatchedAt: null,
                    createdAt: {
                        lt: params.before,
                    },
                    channel: {
                        availableMethods: {
                            emailWeekly: true,
                        },
                    },
                },
                include: notificationDispatchIncluder,
                orderBy: {
                    createdAt: 'asc',
                },
            })

            if (notifications.length === 0) return { notifications: 0, entries: 0 }

            const defaultPermissions = await permissionOperations.readDefaultPermissions({ bypassAuth: true })
            const entries = (await Promise.all(notifications.map(async notification => {
                const recipients = await prisma.user.findMany({
                    where: recipientsWhere(notification, 'emailWeekly', defaultPermissions),
                    select: { id: true },
                })
                return recipients.map(user => ({
                    userId: user.id,
                    notificationId: notification.id,
                }))
            }))).flat()

            await prisma.$transaction([
                prisma.weeklyMailOutboxEntry.createMany({
                    data: entries,
                    skipDuplicates: true,
                }),
                prisma.notification.updateMany({
                    where: {
                        id: {
                            in: notifications.map(notification => notification.id),
                        },
                    },
                    data: { emailWeeklyDispatchedAt: new Date() },
                }),
            ])

            return { notifications: notifications.length, entries: entries.length }
        },
    }),

    /**
     * Drains the weekly digest outbox: one mail per user containing every notification queued for
     * them, deleting each user's rows once their digest has been sent. Called by the notification
     * worker after materializeWeeklyOutbox, never from a request.
     *
     * @returns How many digests were sent and how many failed. A failed digest keeps its outbox
     * rows and is retried on the next run. A digest skipped for being invalid is neither: it is
     * not sent, and its rows are deleted as a retry would fail the same way.
     */
    sendWeeklyMail: defineSubOperation({
        operation: () => async ({ prisma }) => {
            const outboxEntries = await prisma.weeklyMailOutboxEntry.findMany({
                include: {
                    notification: {
                        include: {
                            channel: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                    },
                    user: {
                        select: { ...userBasicSelection, email: true },
                    },
                },
                orderBy: {
                    notification: {
                        createdAt: 'asc',
                    },
                },
            })

            const entriesByUser = new Map<number, typeof outboxEntries>()
            outboxEntries.forEach(entry => {
                const userEntries = entriesByUser.get(entry.userId)
                if (userEntries) userEntries.push(entry)
                else entriesByUser.set(entry.userId, [entry])
            })

            const results = await Promise.allSettled(Array.from(entriesByUser.values()).map(async userEntries => {
                const sent = await sendWeeklyEmailDigest(
                    userEntries[0].user,
                    userEntries.map(entry => entry.notification)
                )

                // Only delete after the mail went out or was skipped as invalid - a failed digest
                // keeps its rows and is retried on the next run (at worst duplicating a digest that
                // failed mid-send).
                await prisma.weeklyMailOutboxEntry.deleteMany({
                    where: {
                        id: {
                            in: userEntries.map(entry => entry.id),
                        },
                    },
                })

                return sent
            }))

            const failed = results.filter(result => result.status === 'rejected')
            failed.forEach(result => {
                if (result.status === 'rejected') logger.error(`Failed to send a weekly digest: ${result.reason}`)
            })

            return {
                digests: results.filter(result => result.status === 'fulfilled' && result.value).length,
                failed: failed.length,
            }
        },
    }),
} as const
