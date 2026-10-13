import { imageCollectionIdOrNameSchema, imageDataFieldSchemas } from '@/services/images/subservice/schemas'
import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    collectionName: imageDataFieldSchemas.shape.collectionName,
    collectionDescription: imageDataFieldSchemas.shape.collectionDescription,
    visibilityAdminRequirements: visibilityRequirementsSchema.min(
        1, 'Du må velge hvem som kan administrere albumet'
    ),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    showOnlyCollectionsSessionAdministrates: z.boolean(),
})

export const dynamicImageSchemas = {
    data: {
        createCollection: dataFieldSchemas.pick({
            collectionName: true,
            collectionDescription: true,
            visibilityAdminRequirements: true,
        }),
    },
    params: {
        visibility: imageCollectionIdOrNameSchema,
        readCollection: imageCollectionIdOrNameSchema,
        readCollectionPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            paramsFieldSchemas.pick({
                showOnlyCollectionsSessionAdministrates: true,
            }),
        ),
    },
}
