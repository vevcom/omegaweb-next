import '@pn-server-only'
import { notificationMethodIncluder } from './constants'
import { notificationSubscriptionAuth } from './auth'
import { notificationSubscriptionSchemas } from './schemas'
import { resolveSubscriptions } from './resolve'
import { findDescendantIds, validateMethods } from '@/services/notifications/channels/subservice/helpers'
import { allNotificationMethodsOn } from '@/services/notifications/constants'
import { availableNotificationMethodIncluder } from '@/services/notifications/channels/subservice/constants'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { ResolvedSubscription, Subscription } from './types'

export const notificationSubscriptionOperations = {
    /** The user's subscription to every channel, as their rows resolve, see resolveSubscriptions. */
    read: defineOperation({
        paramsSchema: notificationSubscriptionSchemas.params.read,
        authorizer: ({ params }) => notificationSubscriptionAuth.read.data({ userId: params.userId }),
        operation: async ({ prisma, params }): Promise<ResolvedSubscription[]> => {
            const [channels, subscriptions] = await Promise.all([
                prisma.notificationChannel.findMany({
                    select: { id: true, parentId: true, availableMethods: { select: allNotificationMethodsOn } },
                }),
                prisma.notificationSubscription.findMany({
                    where: { userId: params.userId },
                    include: notificationMethodIncluder,
                }),
            ])
            return resolveSubscriptions(channels, subscriptions)
        },
    }),

    /**
     * Sets the user's own methods for a channel, which from then on decide what they get there,
     * whatever they have on the channels above. Every method off is kept as a row too, since the
     * channel would otherwise follow the one above again. With includeChildren, the rows the user
     * has for the channels under it are dropped, so those follow this one.
     * @returns The subscription as it is afterwards.
     */
    update: defineOperation({
        authorizer: ({ params }) => notificationSubscriptionAuth.update.data({ userId: params.userId }),
        paramsSchema: notificationSubscriptionSchemas.params.update,
        dataSchema: notificationSubscriptionSchemas.data.update,
        transaction: 'RUNS_IN',
        operation: async ({ prisma, params, data: { includeChildren, ...methods } }): Promise<Subscription> => {
            const channel = await prisma.notificationChannel.findUniqueOrThrow({
                where: { id: params.channelId },
                include: availableNotificationMethodIncluder,
            })
            if (!validateMethods(channel.availableMethods, methods)) {
                throw new ServiceError('BAD PARAMETERS', 'Metodene må være blant de tilgjengelige metodene.')
            }

            if (includeChildren) {
                const channels = await prisma.notificationChannel.findMany({ include: availableNotificationMethodIncluder })
                await destroySubscriptions(prisma, {
                    userId: params.userId,
                    channelId: { in: findDescendantIds(params.channelId, channels) },
                })
            }

            const existing = await prisma.notificationSubscription.findUnique({
                where: { userId_channelId: params },
                select: { methodsId: true },
            })
            if (existing) {
                await prisma.notificationMethod.update({ where: { id: existing.methodsId }, data: methods })
                return prisma.notificationSubscription.findUniqueOrThrow({
                    where: { userId_channelId: params },
                    include: notificationMethodIncluder,
                })
            }
            return prisma.notificationSubscription.create({
                data: {
                    user: { connect: { id: params.userId } },
                    channel: { connect: { id: params.channelId } },
                    methods: { create: methods },
                },
                include: notificationMethodIncluder,
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

/** Deletes the subscriptions matched, and their method rows, which do not cascade. */
async function destroySubscriptions(prisma: Prisma.TransactionClient, where: Prisma.NotificationSubscriptionWhereInput) {
    const subscriptions = await prisma.notificationSubscription.findMany({ where, select: { methodsId: true } })
    await prisma.notificationSubscription.deleteMany({ where })
    await prisma.notificationMethod.deleteMany({
        where: { id: { in: subscriptions.map(subscription => subscription.methodsId) } },
    })
}
