import { z } from 'zod'

export const careerFrontpageHighlightDataFieldSchemas = z.object({
    eventId: z.number().int().nullable(),
    jobAdId: z.number().int().nullable(),
    start: z.date({ required_error: 'Start må fylles ut' }),
    end: z.date({ required_error: 'Slutt må fylles ut' }),
})

export const careerFrontpageHighlightParamsFieldSchemas = z.object({
    id: z.number(),
})
