import { z } from 'zod'

export const omegaquoteDataFieldSchemas = z.object({
    quote: z.string().min(1, 'Sitatet kan ikke være tomt'),
    author: z.string().min(1, 'Noen må siteres'),
})

export const omegaquoteParamsFieldSchemas = z.object({
    id: z.number(),
    userPosterId: z.number(),
})
