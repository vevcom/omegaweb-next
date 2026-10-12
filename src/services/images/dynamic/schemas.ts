import { imageSchemas, baseSchema } from '@/services/images/subservice/schemas'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

export const dynamicImageSchemas = {
    paramsSchemaCollection: imageSchemas.paramsSchemaCollection,
    createCollection: baseSchema.pick({
        collectionName: true,
        collectionDescription: true,
    }).extend({
        visibilityAdminRequirements: visibilityRequirementsSchema.min(
            1, 'Du må velge hvem som kan administrere albumet'
        ),
    }),
    readCollectionPage: readPageInputSchemaObject(
        z.object({
            id: z.number()
        }),
        z.object({
            showOnlyCollectionsSessionAdministrates: z.boolean()
        })
    ),
} as const
