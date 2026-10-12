import { Require } from '@/auth/authorizer/Require'
import type { PaymentProvider } from '@/prisma-generated-pn-types'

export const paymentAuth = {
    // The one place the "MANUAL requires LEDGER_ADMIN" rule lives: MANUAL payments mark
    // themselves SUCCEEDED immediately with a caller-supplied fee and no real payment ever
    // collected, so every caller of paymentOperations.create - deposits, event/cabin payments,
    // and any future one - gets this for free instead of having to re-implement it themselves.
    create: ({ provider }: { provider: PaymentProvider }) => {
        const ledgerUse = Require.permission('LEDGER_USE')
        return provider === 'MANUAL' ? ledgerUse.permission('LEDGER_ADMIN') : ledgerUse
    },

    // Starts real payment collection. Operates on a paymentId before any ledger entries exist,
    // so there is no account to check ownership against.
    initiate: Require.permission('LEDGER_USE'),

    // Cancels a still-pending payment attempt (e.g. an abandoned Stripe checkout). Same bar as
    // initiate - no account exists to check ownership against at this stage either.
    cancel: Require.permission('LEDGER_USE'),
} as const
