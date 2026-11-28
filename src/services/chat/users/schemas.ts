import { z } from 'zod'

export const chatUserParamsFieldSchemas = z.object({
    userId: z.number().int(),
})
