export const PAYMENT_HOURS_AFTER_PROMOTION = 24

/**
 * Someone let in from the waiting list late still gets time to pay, even past the variant's end.
 * The time counts from when payment opens, so someone let in before that gets all of it.
 */
export function paymentDeadline(paymentStart: Date, paymentEnd: Date, promotedAt: Date | null) {
    if (!promotedAt) return paymentEnd
    const windowStart = Math.max(promotedAt.getTime(), paymentStart.getTime())
    const afterPromotion = windowStart + PAYMENT_HOURS_AFTER_PROMOTION * 60 * 60 * 1000
    return new Date(Math.max(paymentEnd.getTime(), afterPromotion))
}

/** A registration as it is read: when it must be paid by, in place of when it was promoted. Null without payment. */
export function withPaymentDeadline<Registration extends { promotedAt: Date | null }>(
    { promotedAt, ...registration }: Registration,
    variant: { paymentStart: Date | null, paymentEnd: Date | null },
): Omit<Registration, 'promotedAt'> & { paymentDeadline: Date | null } {
    return {
        ...registration,
        paymentDeadline: variant.paymentStart && variant.paymentEnd
            ? paymentDeadline(variant.paymentStart, variant.paymentEnd, promotedAt)
            : null,
    }
}
