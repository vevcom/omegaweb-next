import { ManualReviewProblem } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    transactionId: z.number(),
    paymentId: z.number(),
    problem: z.nativeEnum(ManualReviewProblem),
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
            paymentId: true,
            problem: true,
            problemDescription: true,
            error: true,
        }).partial({ transactionId: true, paymentId: true, problemDescription: true }),
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
