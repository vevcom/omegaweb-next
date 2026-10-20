import type { ManualReviewProblem } from '@/prisma-generated-pn-types'

/** The description a review of each problem gets when its creator gives none. */
export const manualReviewProblemDescriptions = {
    STRIPE_DISPUTE: 'Stripe-betaling er bestridt (dispute) av kortholder.',
    STRIPE_REFUND: 'Stripe-betaling ble refundert.',
    COMPLETION_HOOK_FAILED: 'Fullføringshook feilet etter vellykket betaling.',
    CABIN_DOUBLE_BOOKING: 'Hytta ble dobbeltbooket mens betalingen pågikk og gjesten(e) har ingen konto for '
        + 'automatisk refusjon.',
    STALE_PENDING: 'Tidsavbrutt transaksjon kunne ikke kanselleres automatisk.',
    UNCLAIMED_PAYMENT: 'Betaling gikk gjennom, men ble ikke brukt og kunne ikke tilbakebetales automatisk.',
    UNBALANCED: 'Transaksjon markert som vellykket summerer ikke til null.',
} satisfies Record<ManualReviewProblem, string>
