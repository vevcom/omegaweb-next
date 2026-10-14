import { notificationMethodSchema } from '@/services/notifications/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(2),
    description: z.string(),
    parentId: z.coerce.number().min(1),
    mailAliasId: z.coerce.number().min(1),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    availableMethods: notificationMethodSchema,
    defaultMethods: notificationMethodSchema,
})

export const notificationChannelSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
            parentId: true,
        }),
        update: dataFieldSchemas.pick({
            name: true,
            description: true,
            parentId: true,
            mailAliasId: true,
        }),
    },
    params: {
        create: paramsFieldSchemas.pick({
            availableMethods: true,
            defaultMethods: true,
        }),
        update: paramsFieldSchemas.pick({
            id: true,
            availableMethods: true,
            defaultMethods: true,
        }),
        destroy: paramsFieldSchemas.pick({
            id: true,
        }),
    },
}
