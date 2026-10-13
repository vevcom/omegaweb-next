import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    building: z.string(),
    floor: z.coerce.number(),
    id: z.coerce.number(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

export const lockersSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            building: true,
            floor: true,
            id: true,
        }),
    },
    params: {
        read: paramsFieldSchemas.pick({
            id: true,
        }),
        readPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            z.undefined(),
        ),
    },
}
