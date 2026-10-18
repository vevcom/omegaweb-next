import { z } from 'zod'

const paramsFieldSchemas = z.object({
    transactionId: z.number(),
    problemDescription: z.string(),
    error: z.unknown().optional(),
    reviewId: z.number(),
})

const dataFieldSchemas = z.object({
    resolutionDescription: z.string().trim().min(1),
})

export const manualReviewSchemas = {
    params: {
        create: paramsFieldSchemas.pick({
            transactionId: true,
            problemDescription: true,
            error: true,
        }),
        resolve: paramsFieldSchemas.pick({
            reviewId: true,
        }),
    },
    data: {
        resolve: dataFieldSchemas.pick({
            resolutionDescription: true,
        }),
    },
}
