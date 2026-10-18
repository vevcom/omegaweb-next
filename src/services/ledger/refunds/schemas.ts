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
        // The original's own entries are always negated first; this only needs to name an
        // account when that alone doesn't balance to zero, which happens whenever some of the
        // money came in through Stripe rather than from a payer's own ledger balance - there's
        // nothing in the original to flip back for that part. Naming an account that already has
        // a negated entry overwrites it rather than adding to it, which is also how a mixed
        // balance-and-Stripe payment resolves correctly: the payer's one entry gets replaced with
        // the full amount they're owed, not just their own balance portion.
        refundTo: refundToEntry.array().min(1).optional().refine(
            entries => !entries || entries.length === 1 || entries.every(entry => entry.funds !== undefined),
            { message: 'Beløp må oppgis for hver konto når flere kontoer er oppgitt.' }
        ),
    }),
}
