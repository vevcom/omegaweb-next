import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    validFrom: z.coerce.date(),
    copyPreviousPrices: Zpn.checkboxOrBoolean({ label: '' }),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
})

const pricePeriodId = paramsFieldSchemas.pick({
    id: true,
})

export const cabinPricePeriodSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            validFrom: true,
            copyPreviousPrices: true,
        }),
        update: dataFieldSchemas.pick({
            validFrom: true,
        }),
    },
    params: {
        destroy: pricePeriodId,
        update: pricePeriodId,
    },
}
