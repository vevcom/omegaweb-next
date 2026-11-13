import { PaymentProvider } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    paymentId: z.number(),
    funds: z.number(),
    descriptionLong: z.string().optional(),
    descriptionShort: z.string().optional(),
    provider: z.nativeEnum(PaymentProvider),
    manualFees: z.number().optional(),
    bankAccountNumber: z.string().optional(),
    userId: z.number().optional(),
})

const payment = paramsFieldSchemas.pick({
    paymentId: true,
})

export const paymentSchemas = {
    params: {
        create: paramsFieldSchemas.pick({
            funds: true,
            descriptionLong: true,
            descriptionShort: true,
            provider: true,
            manualFees: true,
            bankAccountNumber: true,
            userId: true,
        }),
        initiate: payment,
        cancel: payment,
    },
}
