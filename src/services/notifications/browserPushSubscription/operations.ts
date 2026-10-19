import '@pn-server-only'
import { browserPushSubscriptionAuth } from './auth'
import { browserPushSubscriptionSchemas } from './schemas'
import { maxBrowserPushSubscriptionsPerUser } from './constants'
import { defineOperation } from '@/services/serviceOperation'

export const browserPushSubscriptionOperations = {
    /**
     * Saves the browser's push subscription for the user. A browser has one subscription whoever
     * signs in on it, so a subscription saved for someone else moves to this user. Only the user's
     * most recently saved subscriptions are kept.
     */
    create: defineOperation({
        paramsSchema: browserPushSubscriptionSchemas.params.create,
        dataSchema: browserPushSubscriptionSchemas.data.create,
        authorizer: ({ params }) => browserPushSubscriptionAuth.create.data({ userId: params.userId }),
        operation: async ({ prisma, params, data }) => {
            await prisma.browserPushSubscription.upsert({
                where: { pushServiceUrl: data.pushServiceUrl },
                create: { userId: params.userId, ...data },
                update: { userId: params.userId, ...data },
            })

            const outdated = await prisma.browserPushSubscription.findMany({
                where: { userId: params.userId },
                orderBy: { updatedAt: 'desc' },
                skip: maxBrowserPushSubscriptionsPerUser,
                select: { id: true },
            })
            await prisma.browserPushSubscription.deleteMany({
                where: {
                    id: {
                        in: outdated.map(subscription => subscription.id),
                    },
                },
            })
        },
    }),

    destroy: defineOperation({
        paramsSchema: browserPushSubscriptionSchemas.params.destroy,
        authorizer: async ({ params, prisma }) => {
            const { userId } = await prisma.browserPushSubscription.findUniqueOrThrow({
                where: { pushServiceUrl: params.pushServiceUrl },
                select: { userId: true },
            })
            return browserPushSubscriptionAuth.destroy.data({ userId })
        },
        operation: async ({ prisma, params }) => {
            await prisma.browserPushSubscription.deleteMany({
                where: { pushServiceUrl: params.pushServiceUrl },
            })
        },
    }),
} as const
