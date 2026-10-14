import { Zpn } from '@/lib/fields/zpn'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().max(25, 'max lengde 25').min(2, 'min lengde 2'),
    description: z.string().max(200, 'max lengde 200').min(2, 'min lengde 2').or(z.literal('')),
    endDateTime: Zpn.date({ label: 'Avsluttning' }).optional(),
    published: Zpn.checkboxOrBoolean({ label: 'Publisert' }),

    /**
     * Both visibility levels are set as the news article is created: created with an empty admin
     * level it would be administrable by anyone until someone narrowed it. The regular level may
     * stay empty, which means everyone - whereas a requirement with no conditions at all can never
     * be satisfied, and so means no one but those bypassing with a permission.
     */
    visibilityAdminRequirements: Zpn.json({
        label: 'Hvem kan administrere',
        schema: visibilityRequirementsSchema.min(1, 'Du må velge hvem som kan administrere nyheten'),
    }),
    visibilityRegularRequirements: Zpn.json({
        label: 'Hvem kan lese',
        schema: visibilityRequirementsSchema,
    }).default([]),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    newsId: z.number(),
})

const newsId = paramsFieldSchemas.pick({
    id: true,
})

export const newsSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
            endDateTime: true,
            visibilityAdminRequirements: true,
            visibilityRegularRequirements: true,
        }),
        update: dataFieldSchemas.pick({
            name: true,
            description: true,
            endDateTime: true,
        }).partial(),
        setPublished: dataFieldSchemas.pick({
            published: true,
        }),
    },
    params: {
        visibility: newsId,
        read: newsId,
        destroy: newsId,
        readOldPage: readPageInputSchemaObject(newsId, z.undefined()),
        update: newsId,
        setPublished: newsId,
        updateArticle: paramsFieldSchemas.pick({
            newsId: true,
        }),
    },
}
