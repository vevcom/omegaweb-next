import { z } from 'zod'

const ledgerEntryInput = z.object({
    ledgerAccountId: z.number(),
    funds: z.number(),
})

export const refundParamsSchemas = {
    refund: z.object({
        originalTransactionId: z.number(),
        reason: z.string(),
        ledgerEntries: ledgerEntryInput.array().min(1),
    }),
    reimburseUnappliedPayment: z.object({
        originalTransactionId: z.number(),
        reason: z.string(),
        // Only needed when the caller already knows the real Stripe fee and the payment's own
        // row never got to record it, which is the late-success-after-cancel case, where the
        // webhook's own guarded update never applied. Leave unset when payment.fees is already
        // correct.
        fees: z.number().optional(),
    }),
}
