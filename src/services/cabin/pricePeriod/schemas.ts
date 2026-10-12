import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const fieldSchemas = z.object({
    id: z.number(),
    validFrom: z.coerce.date(),
    copyPreviousPrices: Zpn.checkboxOrBoolean({ label: '' }),
})

export const cabinPricePeriodSchemas = {
    create: fieldSchemas.pick({
        validFrom: true,
        copyPreviousPrices: true,
    }),
    update: fieldSchemas.pick({
        validFrom: true,
    }),
} as const

const pricePeriodId = fieldSchemas.pick({
    id: true,
})

export const cabinPricePeriodParamsSchemas = {
    destroy: pricePeriodId,
    update: pricePeriodId,
} as const
