import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(3),
    description: z.string(),
})

const paramsFieldSchemas = z.object({
    shopId: z.number(),
})

export const shopSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
        }),
    },
    params: {
        read: paramsFieldSchemas.pick({
            shopId: true,
        }),
    },
}
