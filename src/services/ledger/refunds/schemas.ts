import { z } from 'zod'

const paramsFieldSchemas = z.object({
    originalTransactionId: z.number(),
    reason: z.string(),
    // The ledger account that gets what flipping the entries leaves over, which is only needed
    // when money came in from outside the ledger, e.g. through Stripe.
    refundTo: z.number().optional(),
})

export const refundSchemas = {
    params: {
        reverseTransaction: paramsFieldSchemas.pick({
            originalTransactionId: true,
            reason: true,
            refundTo: true,
        }),
        reimburseUnappliedPayment: paramsFieldSchemas.pick({
            originalTransactionId: true,
            reason: true,
        }),
    },
}
