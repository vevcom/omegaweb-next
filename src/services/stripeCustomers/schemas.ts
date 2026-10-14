import { z } from 'zod'

const paramsFieldSchemas = z.object({
    userId: z.number(),
    paymentMethodId: z.string(),
})

const customerUser = paramsFieldSchemas.pick({
    userId: true,
})

export const stripeCustomerSchemas = {
    params: {
        readOrCreate: customerUser,
        createSession: customerUser,
        createSetupIntent: customerUser,
        readSavedPaymentMethods: customerUser,
        deleteSavedPaymentMethod: paramsFieldSchemas.pick({
            userId: true,
            paymentMethodId: true,
        }),
    },
}
