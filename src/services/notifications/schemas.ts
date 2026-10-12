import { Permission } from '@/prisma-generated-pn-types'
import { z } from 'zod'

export const notificationMethodSchema = z.object({
    email: z.boolean(),
    emailWeekly: z.boolean(),
})

const baseSchema = z.object({
    channelId: z.coerce.number().min(1),
    title: z.string().min(2),
    message: z.string().min(10),
    // Who the notification is for, on top of being subscribed to its channel. Each given part narrows it.
    audience: z.object({
        userIds: z.number().array().optional(),
        visibilityId: z.number().optional(),
        permission: z.nativeEnum(Permission).optional(),
    }).optional(),
})

export const notificationSchemas = {
    create: baseSchema.pick({
        channelId: true,
        title: true,
        message: true,
        audience: true,
    }),

    createSpecial: baseSchema.pick({
        title: true,
        message: true,
        audience: true,
    }),
}
