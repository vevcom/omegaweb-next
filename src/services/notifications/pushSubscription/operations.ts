import '@pn-server-only'
import { pushSubscriptionAuth } from './auth'
import { pushSubscriptionSchemas } from './schemas'
import { maxPushSubscriptionsPerUser } from './constants'
import { defineOperation } from '@/services/serviceOperation'

export const pushSubscriptionOperations = {
    /**
     * Saves the browser's push subscription for the user. A browser has one subscription whoever
     * signs in on it, so a subscription saved for someone else moves to this user. Only the user's
     * most recently saved subscriptions are kept.
     */
    create: defineOperation({
        paramsSchema: pushSubscriptionSchemas.params.create,
        dataSchema: pushSubscriptionSchemas.data.create,
        authorizer: ({ params }) => pushSubscriptionAuth.create.data({ userId: params.userId }),
        operation: async ({ prisma, params, data }) => {
            await prisma.pushSubscription.upsert({
                where: { pushServiceUrl: data.pushServiceUrl },
                create: { userId: params.userId, ...data },
                update: { userId: params.userId, ...data },
            })

            const outdated = await prisma.pushSubscription.findMany({
                where: { userId: params.userId },
                orderBy: { updatedAt: 'desc' },
                skip: maxPushSubscriptionsPerUser,
                select: { id: true },
            })
            await prisma.pushSubscription.deleteMany({
                where: {
                    id: {
                        in: outdated.map(pushSubscription => pushSubscription.id),
                    },
                },
            })
        },
    }),

    destroy: defineOperation({
        paramsSchema: pushSubscriptionSchemas.params.destroy,
        authorizer: async ({ params, prisma }) => {
            const { userId } = await prisma.pushSubscription.findUniqueOrThrow({
                where: { pushServiceUrl: params.pushServiceUrl },
                select: { userId: true },
            })
            return pushSubscriptionAuth.destroy.data({ userId })
        },
        operation: async ({ prisma, params }) => {
            await prisma.pushSubscription.deleteMany({
                where: { pushServiceUrl: params.pushServiceUrl },
            })
        },
    }),
} as const
