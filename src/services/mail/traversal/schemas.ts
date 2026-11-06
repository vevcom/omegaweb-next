import { z } from 'zod'

const paramsFieldSchemas = z.object({
    id: z.coerce.number().min(1),
})

export const mailTraversalSchemas = {
    params: {
        read: paramsFieldSchemas.pick({
            id: true,
        }),
    },
}
