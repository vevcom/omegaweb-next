import { z } from 'zod'

export const refundParamsSchemas = {
    reverseTransaction: z.object({
        originalTransactionId: z.number(),
        reason: z.string(),
        // The ledger account that gets what flipping the entries leaves over, which is only needed
        // when money came in from outside the ledger, e.g. through Stripe.
        refundTo: z.number().optional(),
    }),
    reimburseUnappliedPayment: z.object({
        originalTransactionId: z.number(),
        reason: z.string(),
    }),
}
