import { z } from 'zod'

const refundToEntry = z.object({
    ledgerAccountId: z.number(),
    // Required once more than one account is listed - with only one, whatever balances the rest
    // of the reversal is unambiguous and filled in automatically.
    funds: z.number().optional(),
})

export const refundParamsSchemas = {
    reverseTransaction: z.object({
        originalTransactionId: z.number(),
        reason: z.string(),
        // Only needed when negating the original doesn't balance, i.e. money came in through
        // Stripe. An account that already has a negated entry is overwritten, not added to.
        refundTo: refundToEntry.array().min(1).optional().refine(
            entries => !entries || entries.length === 1 || entries.every(entry => entry.funds !== undefined),
            { message: 'Beløp må oppgis for hver konto når flere kontoer er oppgitt.' }
        ),
    }),
    reimburseUnappliedPayment: z.object({
        originalTransactionId: z.number(),
        reason: z.string(),
    }),
}
