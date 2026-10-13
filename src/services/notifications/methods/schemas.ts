import { z } from 'zod'

const paramsFieldSchemas = z.object({
    notificationId: z.number(),
    before: z.date(),
})

export const notificationMethodSchemas = {
    params: {
        dispatchEmail: paramsFieldSchemas.pick({
            notificationId: true,
        }),
        materializeWeeklyOutbox: paramsFieldSchemas.pick({
            before: true,
        }),
    },
}
