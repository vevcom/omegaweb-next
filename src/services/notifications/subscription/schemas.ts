import { notificationMethodSchema } from '@/services/notifications/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    subscriptions: z.array(z.object({
        channelId: z.number().min(1),
        methods: notificationMethodSchema,
    })),
})

const paramsFieldSchemas = z.object({
    userId: z.number(),
})

const subscriptionUser = paramsFieldSchemas.pick({
    userId: true,
})

export const notificationSubscriptionSchemas = {
    data: {
        update: dataFieldSchemas.pick({
            subscriptions: true,
        }),
    },
    params: {
        read: subscriptionUser,
        createDefault: subscriptionUser,
        update: subscriptionUser,
    },
}
