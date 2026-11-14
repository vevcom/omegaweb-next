import { internalPathMessage, isInternalPath } from '@/lib/fields/safeLink'
import { Zpn } from '@/lib/fields/zpn'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { Permission } from '@/prisma-generated-pn-types'
import { z } from 'zod'

export const notificationMethodSchema = z.object({
    email: z.boolean(),
    emailWeekly: z.boolean(),
    push: z.boolean(),
})

const audienceFieldSchemas = z.object({
    userIds: z.number().array().optional(),
    permission: z.nativeEnum(Permission).optional(),
    canRegisterForEventId: z.number().optional(),
    registeredForEventId: z.number().optional(),
})

export const notificationChannelDataFieldSchemas = z.object({
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
    audience: Zpn.json({
        label: 'Mottakere',
        schema: z.union([
            audienceFieldSchemas.extend({
                visibilityId: z.number().optional(),
                requirements: z.undefined().optional(),
            }),
            audienceFieldSchemas.extend({
                visibilityId: z.undefined().optional(),
                requirements: visibilityRequirementsSchema.refine(
                    requirements => requirements.every(requirement => requirement.conditions.length > 0),
                    'Hvert krav til mottakerne må ha minst én gruppe',
                ),
            }),
        ]),
    }).optional(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    channelId: z.coerce.number().min(1),
    availableMethods: notificationMethodSchema,
})

const dataFieldSchemas = notificationChannelDataFieldSchemas

export const notificationChannelSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
            parentId: true,
        }),
        createAsConfigured: dataFieldSchemas.pick({ name: true }).extend({
            parentId: dataFieldSchemas.shape.parentId.optional(),
        }),
        update: dataFieldSchemas.pick({
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
        create: paramsFieldSchemas.pick({
            availableMethods: true,
        }),
        update: paramsFieldSchemas.pick({
            id: true,
            availableMethods: true,
        }),
        destroy: paramsFieldSchemas.pick({
            id: true,
        }),
        createNotification: paramsFieldSchemas.pick({
            channelId: true,
        }),
    },
}
