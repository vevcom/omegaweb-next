import { STRIPE_MINIMUM_PAYMENT_AMOUNT } from '@/services/ledger/payments/constants'
import { displayAmount } from '@/lib/currency/convert'
import { PaymentProvider } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const paramsFieldSchemas = z.object({
    ledgerAccountId: z.number(),
    provider: z.nativeEnum(PaymentProvider),
    funds: z.coerce.number().int(),
    manualFees: z.coerce.number().nonnegative().default(0),
    fees: z.number().nonnegative().default(0),
    // Only honored for MANUAL movements, which already require LEDGER_ADMIN (see paymentAuth.create).
    // For every other provider the transaction's description is left unset so that it falls back to
    // a translated purpose label instead (see LedgerTransactionRow).
    description: z.string().optional(),
})

export const ledgerMovementSchemas = {
    params: {
        createDeposit: paramsFieldSchemas.pick({
            ledgerAccountId: true,
            provider: true,
            funds: true,
            manualFees: true,
            description: true,
        }).refine(
            ({ provider, funds }) => provider !== 'STRIPE' || funds >= STRIPE_MINIMUM_PAYMENT_AMOUNT,
            `Innskudd med kort må være minst ${displayAmount(STRIPE_MINIMUM_PAYMENT_AMOUNT, false)}.`
        ),
        createPayout: paramsFieldSchemas.pick({
            ledgerAccountId: true,
            fees: true,
            description: true,
        }).extend({
            // A payout has no minimum, its funds default to 0 and are not coerced, unlike a deposit's.
            funds: z.number().nonnegative().default(0),
        }).refine(({ funds, fees }) => funds || fees, 'Både beløp og avgifter kan ikke være 0 samtidig.'),
    },
}
