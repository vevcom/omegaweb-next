import { z } from 'zod'

export const dotFreezePeriodDataFieldSchemas = z.object({
    start: z.date({ required_error: 'Start må fylles ut' }),
    end: z.date({ required_error: 'Slutt må fylles ut' }),
    reason: z.string().max(200, 'Begrunnelse kan ha maks 200 tegn').trim(),
})

export const dotFreezePeriodParamsFieldSchemas = z.object({
    id: z.number(),
})
