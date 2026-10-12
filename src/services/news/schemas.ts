import { Zpn } from '@/lib/fields/zpn'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

const baseSchema = z.object({
    name: z.string().max(25, 'max lengde 25').min(2, 'min lengde 2'),
    description: z.string().max(200, 'max lengde 200').min(2, 'min lengde 2').or(z.literal('')),
    endDateTime: Zpn.date({ label: 'Avsluttning' }).optional()
})

/**
 * Both visibility levels are set as the news article is created: created with an empty admin level it
 * would be administrable by anyone until someone narrowed it. The regular level may stay empty,
 * which means everyone - whereas a requirement with no conditions at all can never be satisfied,
 * and so means no one but those bypassing with a permission.
 */
const visibilityLevelFields = {
    visibilityAdminRequirements: Zpn.json({
        label: 'Hvem kan administrere',
        schema: visibilityRequirementsSchema.min(1, 'Du må velge hvem som kan administrere nyheten'),
    }),
    visibilityRegularRequirements: Zpn.json({
        label: 'Hvem kan lese',
        schema: visibilityRequirementsSchema,
    }).default([]),
}

export const newsSchemas = {
    params: z.object({
        id: z.number()
    }),
    create: baseSchema.pick({
        name: true,
        description: true,
        endDateTime: true
    }).extend(visibilityLevelFields),
    update: baseSchema.pick({
        name: true,
        description: true,
        endDateTime: true
    }).partial(),
    setPublished: z.object({
        published: Zpn.checkboxOrBoolean({ label: 'Publisert' })
    }),
    readOldPage: readPageInputSchemaObject(
        z.object({
            id: z.number(),
        }),
        z.undefined()
    ),
} as const
