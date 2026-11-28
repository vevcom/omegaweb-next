import { ManualReviewProblem } from '@/prisma-generated-pn/enums'
import { z } from 'zod'

export const manualReviewParamsFieldSchemas = z.object({
    transactionId: z.number(),
    paymentId: z.number(),
    problem: z.nativeEnum(ManualReviewProblem),
    problemDescription: z.string(),
    error: z.unknown().optional(),
    reviewId: z.number(),
})

export const manualReviewDataFieldSchemas = z.object({
    resolutionDescription: z.string().trim().min(1),
})
