import { z } from 'zod'

const paramsFieldSchemas = z.object({
    notificationId: z.number(),
    before: z.date(),
})

const dispatchedNotification = paramsFieldSchemas.pick({
    notificationId: true,
})

export const notificationMethodSchemas = {
    params: {
        dispatchEmail: dispatchedNotification,
        dispatchPush: dispatchedNotification,
        materializeWeeklyOutbox: paramsFieldSchemas.pick({
            before: true,
        }),
    },
}
