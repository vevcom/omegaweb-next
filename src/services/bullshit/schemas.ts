import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    quote: z.string().min(1, 'Sitatet kan ikke være tomt'),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

export const bullshitSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            quote: true,
        }),
    },
    params: {
        readPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            z.undefined()
        ),
    },
}
