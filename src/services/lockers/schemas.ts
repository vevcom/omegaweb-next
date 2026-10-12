import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

const baseSchema = z.object({
    building: z.string(),
    floor: z.coerce.number(),
    id: z.coerce.number()
})

export const lockersSchemas = {
    create: baseSchema.pick({
        building: true,
        floor: true,
        id: true
    }),

    createLocation: baseSchema.pick({
        building: true,
        floor: true,
    }),

    readPage: readPageInputSchemaObject(
        z.object({
            id: z.number(),
        }),
        z.undefined(),
    ),
}
