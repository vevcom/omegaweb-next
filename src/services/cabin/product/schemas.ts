import { Zpn } from '@/lib/fields/zpn'
import { convertAmount } from '@/lib/currency/convert'
import { BookingType } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    type: z.nativeEnum(BookingType),
    amount: z.coerce.number().int().min(0),
    name: z.string().min(2),
    description: z.string().min(0).max(20),
    price: z.coerce.number().min(0).transform((val) => convertAmount(val)),
    cronInterval: Zpn.simpleCronExpression(),
    memberShare: z.coerce.number().min(0).max(100),
    pricePeriodId: z.coerce.number(),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    cabinProductId: z.number(),
})

export const cabinProductSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            type: true,
            amount: true,
        }),
        createPrice: dataFieldSchemas.pick({
            description: true,
            price: true,
            cronInterval: true,
            memberShare: true,
            pricePeriodId: true,
        }),
    },
    params: {
        createPrice: paramsFieldSchemas.pick({
            cabinProductId: true,
        }),
        read: paramsFieldSchemas.pick({
            id: true,
        }),
    },
}
