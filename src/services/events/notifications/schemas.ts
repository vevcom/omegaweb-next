import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string(),
})

const paramsFieldSchemas = z.object({
    eventId: z.number(),
    userId: z.number(),
    notificationChannelId: z.number(),
    infoNotificationChannelId: z.number(),
    generalNotificationChannelId: z.number(),
})

const eventId = paramsFieldSchemas.pick({
    eventId: true,
})

export const eventNotificationSchemas = {
    data: {
        createChannels: dataFieldSchemas.pick({
            name: true,
        }),
    },
    params: {
        createNotification: eventId,
        createPaymentReminder: eventId,
        createChannels: eventId,
        destroyChannels: paramsFieldSchemas.pick({
            notificationChannelId: true,
            infoNotificationChannelId: true,
            generalNotificationChannelId: true,
        }),
        subscribeToInfoChannel: paramsFieldSchemas.pick({
            eventId: true,
            userId: true,
        }),
    },
}
