import { internalPathMessage, isInternalPath } from '@/lib/fields/safeLink'
import { Permission } from '@/prisma-generated-pn-types'
import { z } from 'zod'

export const notificationMethodSchema = z.object({
    email: z.boolean(),
    emailWeekly: z.boolean(),
    push: z.boolean(),
})

const dataFieldSchemas = z.object({
    name: z.string().min(2),
    description: z.string(),
    parentId: z.coerce.number().min(1),
    mailAliasId: z.coerce.number().min(1),
    title: z.string().min(2),
    message: z.string().min(10),
    url: z.string().trim().max(2048)
        .refine(url => !url || isInternalPath(url), internalPathMessage)
        .transform(url => url || undefined)
        .optional(),
    // Who the notification is for, on top of being subscribed to its channel. Each given part narrows it.
    audience: z.object({
        userIds: z.number().array().optional(),
        visibilityId: z.number().optional(),
        permission: z.nativeEnum(Permission).optional(),
        canRegisterForEventId: z.number().optional(),
    }).optional(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    channelId: z.coerce.number().min(1),
    availableMethods: notificationMethodSchema,
})

export const notificationSchemas = {
    data: {
        createChannel: dataFieldSchemas.pick({
            name: true,
            description: true,
            parentId: true,
        }),
        updateChannel: dataFieldSchemas.pick({
            name: true,
            description: true,
            parentId: true,
            mailAliasId: true,
        }),
        createNotification: dataFieldSchemas.pick({
            title: true,
            message: true,
            url: true,
            audience: true,
        }),
    },
    params: {
        createChannel: paramsFieldSchemas.pick({
            availableMethods: true,
        }),
        updateChannel: paramsFieldSchemas.pick({
            id: true,
            availableMethods: true,
        }),
        destroyChannel: paramsFieldSchemas.pick({
            id: true,
        }),
        createNotification: paramsFieldSchemas.pick({
            channelId: true,
        }),
    },
}
