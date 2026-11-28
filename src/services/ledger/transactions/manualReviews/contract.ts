import { manualReviewDataFieldSchemas, manualReviewParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { defineContract } from '@/services/serviceContract'

// Admin-only throughout. `create`'s real callers always pass bypassAuth - this is a safety net
// for any other caller, the same convention ledgerTransactionAuth.advance/initiate use.
export const manualReviewContract = defineContract({
    create: {
        params: manualReviewParamsFieldSchemas.pick({
            transactionId: true,
            paymentId: true,
            problem: true,
            problemDescription: true,
            error: true,
        }).partial({ transactionId: true, paymentId: true, problemDescription: true }),
        authorizer: Require.permission('LEDGER_ADMIN'),
    },
    readOpen: {
        authorizer: Require.permission('LEDGER_ADMIN'),
    },
    resolve: {
        params: manualReviewParamsFieldSchemas.pick({
            reviewId: true,
        }),
        data: manualReviewDataFieldSchemas.pick({
            resolutionDescription: true,
        }),
        authorizer: Require.permission('LEDGER_ADMIN'),
    },
})
