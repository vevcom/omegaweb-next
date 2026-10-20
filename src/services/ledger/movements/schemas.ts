import { PaymentProvider } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    ledgerAccountId: z.number(),
    // Only required when the balance doesn't cover the price, which createPayment checks.
    provider: z.nativeEnum(PaymentProvider).optional(),
    amountFromBalance: z.coerce.number().nonnegative().default(0),
    manualFees: z.coerce.number().nonnegative().default(0),
    fees: z.number().nonnegative().default(0),
    // Only honored for MANUAL payments, which already require LEDGER_ADMIN. For every other
    // provider the transaction's description is left unset so that it falls back to a translated
    // purpose label instead (see LedgerTransactionRow).
    description: z.string().optional(),
})

export const ledgerMovementSchemas = {
    params: {
        createPayment: paramsFieldSchemas.pick({
            provider: true,
            amountFromBalance: true,
            manualFees: true,
            description: true,
        }),
        createDeposit: paramsFieldSchemas.pick({
            ledgerAccountId: true,
        }).extend({
            // Positive, so a deposit always has a payment to collect.
            funds: z.coerce.number().positive(),
        }),
        createPayout: paramsFieldSchemas.pick({
            ledgerAccountId: true,
            fees: true,
            description: true,
        }).extend({
            // A payout's funds default to 0 and are not coerced, unlike a deposit's.
            funds: z.number().nonnegative().default(0),
        }).refine(({ funds, fees }) => funds || fees, 'Både beløp og avgifter kan ikke være 0 samtidig.'),
    },
}
