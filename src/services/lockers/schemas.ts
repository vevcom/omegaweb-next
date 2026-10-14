import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    building: z.string().trim().min(1),
    floor: z.coerce.number().int(),
    id: z.coerce.number().int().nonnegative(),
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
