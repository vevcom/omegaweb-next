import { refundParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { defineContract } from '@/services/serviceContract'

// Not meant to be called directly by a user. Real callers (cabin's double-booking correction,
// event unregister) always pass bypassAuth. LEDGER_ADMIN here is a safety net for any other
// caller, same pattern as ledgerTransactionAuth.advance.
export const refundContract = defineContract({
    reverseTransaction: {
        params: refundParamsFieldSchemas.pick({
            originalTransactionId: true,
            reason: true,
            refundTo: true,
        }),
        authorizer: Require.permission('LEDGER_ADMIN'),
    },
    reimburseUnappliedPayment: {
        params: refundParamsFieldSchemas.pick({
            originalTransactionId: true,
            reason: true,
        }),
        authorizer: Require.permission('LEDGER_ADMIN'),
    },
})
