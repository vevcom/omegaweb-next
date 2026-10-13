import { z } from 'zod'

const dataFieldSchemas = z.object({
    id: z.coerce.number().min(1),
    name: z.string().min(2).max(50),
    description: z.string().max(200),
})

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
})

export const mailingListSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
        }),
        update: dataFieldSchemas.pick({
            id: true,
            name: true,
            description: true,
        }),
    },
    params: {
        destroy: paramsFieldSchemas.pick({
            id: true,
        }),
    },
}
