import { z } from 'zod'

const paramsFieldSchemas = z.object({
    userId: z.number().int(),
})

export const chatSessionSchemas = {
    params: {
        read: paramsFieldSchemas.pick({ userId: true }),
    },
}
