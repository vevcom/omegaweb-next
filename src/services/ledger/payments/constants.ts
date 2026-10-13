import type { Prisma } from '@/prisma-generated-pn-types'

export const MINIMUM_PAYMENT_AMOUNT = 50_00 // In hundredths of Klinguende Meunt

export const paymentIncluder = {
    stripePayment: true,
    manualPayment: true,
} as const satisfies Prisma.PaymentInclude
