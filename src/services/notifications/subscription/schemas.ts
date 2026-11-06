import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    email: Zpn.checkboxOrBoolean({ label: 'E-post' }),
    emailWeekly: Zpn.checkboxOrBoolean({ label: 'Ukentlig e-post' }),
    push: Zpn.checkboxOrBoolean({ label: 'Push-varsel' }),
    // Whether the user's own rows for the channels under it are dropped, so those follow this one.
    includeChildren: Zpn.checkboxOrBoolean({ label: 'Underkanaler' }).default(false),
})

const paramsFieldSchemas = z.object({
    userId: z.number(),
    channelId: z.number(),
})

const userAndChannel = paramsFieldSchemas.pick({
    userId: true,
    channelId: true,
})

export const notificationSubscriptionSchemas = {
    data: {
        update: dataFieldSchemas.pick({
            email: true,
            emailWeekly: true,
            push: true,
            includeChildren: true,
        }),
    },
    params: {
        read: paramsFieldSchemas.pick({
            userId: true,
        }),
        update: userAndChannel,
        subscribeByDefault: userAndChannel,
    },
}
