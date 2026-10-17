import type { Prisma } from '@/prisma-generated-pn-types'

// Stripe's own processing floor, not a general rule - only applies to a payment actually going
// through Stripe. In hundredths of Klinguende Meunt.
export const STRIPE_MINIMUM_PAYMENT_AMOUNT = 50_00

export const paymentIncluder = {
    stripePayment: true,
    manualPayment: true,
} as const satisfies Prisma.PaymentInclude
