import { Require } from '@/auth/authorizer/Require'

// Creating a Stripe customer, a checkout session or a setup intent all stay strictly
// self-service. None of these may be used to pay, or save a new payment method, on another
// user's behalf, not even by admins. Listing and deleting saved payment methods are exempted
// for LEDGER_ADMIN, so admins can audit or clean up cards without being able to spend them.
const userIdOrLedgerAdmin = Require.permission('LEDGER_ADMIN').or().userId()

export const stripeCustomerAuth = {
    readOrCreate: Require.userId(),
    createSession: Require.userId(),
    createSetupIntent: Require.userId(),

    readSavedPaymentMethods: userIdOrLedgerAdmin,
    deleteSavedPaymentMethod: userIdOrLedgerAdmin,
} as const
