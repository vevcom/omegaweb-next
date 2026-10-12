import { Zpn } from '@/lib/fields/zpn'
import { convertAmount } from '@/lib/currency/convert'
import { BookingType } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const fieldSchemas = z.object({
    id: z.number(),
    type: z.nativeEnum(BookingType),
    amount: z.coerce.number().int().min(0),
    name: z.string().min(2),
    description: z.string().min(0).max(20),
    price: z.coerce.number().min(0).transform((val) => convertAmount(val)),
    cronInterval: Zpn.simpleCronExpression(),
    memberShare: z.coerce.number().min(0).max(100),
    pricePeriodId: z.coerce.number(),
})

export const cabinProductSchemas = {
    create: fieldSchemas.pick({
        name: true,
        type: true,
        amount: true,
    }),

    createPrice: fieldSchemas.pick({
        description: true,
        price: true,
        cronInterval: true,
        memberShare: true,
        pricePeriodId: true,
    }),
} as const

export const cabinProductParamsSchemas = {
    createPrice: z.object({
        cabinProductId: fieldSchemas.shape.id,
    }),
    read: fieldSchemas.pick({
        id: true,
    }),
} as const
