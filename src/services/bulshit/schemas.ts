import { readPageInputSchemaObject } from '@/lib/paging/schema'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    quote: z.string().min(1, 'Sitatet kan ikke være tomt'),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    bulshitPosterId: z.number(),
})

export const bulshitSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            quote: true,
        }),
    },
    params: {
        create: paramsFieldSchemas.pick({
            bulshitPosterId: true,
        }),
        readPage: readPageInputSchemaObject(
            paramsFieldSchemas.pick({
                id: true,
            }),
            z.undefined()
        ),
    },
}
