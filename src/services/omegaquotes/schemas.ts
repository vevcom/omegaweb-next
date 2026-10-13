import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    quote: z.string().min(1, 'Sitatet kan ikke være tomt'),
    author: z.string().min(1, 'Noen må siteres'),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    userPosterId: z.number(),
})

export const omegaquoteSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            quote: true,
            author: true,
        }),
    },
    params: {
        create: paramsFieldSchemas.pick({
            userPosterId: true,
        }),
        readPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            z.undefined(),
        ),
    },
}
