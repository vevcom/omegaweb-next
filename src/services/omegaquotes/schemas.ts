import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

export const baseSchemas = z.object({
    quote: z.string().min(1, 'Sitatet kan ikke være tomt'),
    author: z.string().min(1, 'Noen må siteres'),
})

export const omegaquoteSchemas = {
    create: baseSchemas.pick({
        quote: true,
        author: true,
    }),
    readPage: readPageInputSchemaObject(
        z.object({
            id: z.number(),
        }),
        z.undefined()
    ),
}

