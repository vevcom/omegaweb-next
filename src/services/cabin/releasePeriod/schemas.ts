import { z } from 'zod'

export const cabinReleasePeriodDataFieldSchemas = z.object({
    releaseTime: z.date({ required_error: 'Slippdato må fylles ut' }),
    releaseUntil: z.date({ required_error: 'Slipp inntil dato må fylles ut' }),
})

export const cabinReleasePeriodParamsFieldSchemas = z.object({
    id: z.number(),
})
