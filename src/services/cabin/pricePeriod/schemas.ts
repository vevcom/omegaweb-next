import { z } from 'zod'

export const cabinPricePeriodDataFieldSchemas = z.object({
    validFrom: z.date({ required_error: 'Startdato må fylles ut' }),
    copyPreviousPrices: z.boolean(),
})

export const cabinPricePeriodParamsFieldSchemas = z.object({
    id: z.number(),
})
