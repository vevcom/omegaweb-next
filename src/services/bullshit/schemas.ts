import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

export const baseSchemas = z.object({
    quote: z.string().min(1, 'Sitatet kan ikke være tomt'),
})

export const bullshitSchemas = {
    create: baseSchemas.pick({
        quote: true,
    }),
    readPage: readPageInputSchemaObject(
        z.object({
            id: z.number(),
        }),
        z.undefined()
    ),
}

